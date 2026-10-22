#include <systemc>
#include <tlm>
#include <tlm_utils/simple_initiator_socket.h>
#include <tlm_utils/simple_target_socket.h>
#include <array>
#include <fstream>
#include <iostream>
#include <cstring>
using namespace sc_core;
#ifdef OPENSOC_VERILATED
#include "Vregister_bank.h"
#include "verilated.h"
struct Target : sc_module {
  tlm_utils::simple_target_socket<Target> socket;
  sc_clock clk{"clk",sc_time(10,SC_NS)};
  sc_signal<bool> rst_n{"rst_n"},write_en{"write_en"};
  sc_signal<uint32_t> data_in{"data_in"},data_out{"data_out"};
  Vregister_bank rtl{"actual_rtl"}; bool corrupt,slow;
  Target(sc_module_name n,bool c,bool s):sc_module(n),socket("target"),corrupt(c),slow(s) {
    rtl.clk_i(clk);rtl.rst_ni(rst_n);rtl.write_en_i(write_en);rtl.data_i(data_in);rtl.data_o(data_out);
    socket.register_b_transport(this,&Target::transport);
  }
  void reset() { rst_n=false;write_en=false;wait(11,SC_NS);rst_n=true;wait(1,SC_NS); }
  void transport(tlm::tlm_generic_payload& tx,sc_time& delay) {
    delay+=sc_time(slow?120:20,SC_NS);wait(delay);delay=SC_ZERO_TIME;
    if(tx.get_address()!=0 || tx.get_data_length()!=4) {tx.set_response_status(tlm::TLM_ADDRESS_ERROR_RESPONSE);return;}
    if(tx.is_write()) {
      uint32_t value=data_out.read();auto bytes=reinterpret_cast<unsigned char*>(&value);auto be=tx.get_byte_enable_ptr();
      for(unsigned i=0;i<4;++i) if(!be || be[i%tx.get_byte_enable_length()]) bytes[i]=tx.get_data_ptr()[i];
      data_in=value;write_en=true;wait(clk.posedge_event());wait(1,SC_NS);write_en=false;
    } else {
      uint32_t value=data_out.read();memcpy(tx.get_data_ptr(),&value,4);if(corrupt)tx.get_data_ptr()[0]^=1;
    }
    tx.set_response_status(tlm::TLM_OK_RESPONSE);
  }
};
#else
struct Target : sc_module {
  tlm_utils::simple_target_socket<Target> socket;
  std::array<unsigned char,16> memory{};
  bool corrupt, slow;
  Target(sc_module_name n, bool c, bool s):sc_module(n),socket("target"),corrupt(c),slow(s) { socket.register_b_transport(this,&Target::transport); }
  void reset() {memory.fill(0);}
  void transport(tlm::tlm_generic_payload& tx, sc_time& delay) {
    delay += sc_time(slow ? 120 : 20, SC_NS);
    if (tx.get_address()+tx.get_data_length()>memory.size()) { tx.set_response_status(tlm::TLM_ADDRESS_ERROR_RESPONSE); return; }
    auto be=tx.get_byte_enable_ptr();
    for(unsigned i=0;i<tx.get_data_length();++i) {
      if(be && be[i%tx.get_byte_enable_length()]==0) continue;
      auto &cell=memory[tx.get_address()+i];
      if(tx.is_write()) cell=tx.get_data_ptr()[i]; else tx.get_data_ptr()[i]=cell;
    }
    if(corrupt && tx.is_read()) tx.get_data_ptr()[0]^=1;
    tx.set_response_status(tlm::TLM_OK_RESPONSE);
  }
};
#endif
struct Initiator : sc_module {
  tlm_utils::simple_initiator_socket<Initiator> socket;
  Target& target; bool ok=true; unsigned count=0; std::ofstream trace{"transactions.jsonl"};
  SC_HAS_PROCESS(Initiator);
  Initiator(sc_module_name n, Target& t):sc_module(n),socket("initiator"),target(t) { SC_THREAD(run); }
  bool access(bool write, uint64_t address, uint32_t& data, bool partial=false) {
    tlm::tlm_generic_payload tx; sc_time delay=SC_ZERO_TIME;
    unsigned char be[4]={0xff,0,0xff,0};
    tx.set_command(write?tlm::TLM_WRITE_COMMAND:tlm::TLM_READ_COMMAND); tx.set_address(address);
    tx.set_data_ptr(reinterpret_cast<unsigned char*>(&data)); tx.set_data_length(4); tx.set_streaming_width(4);
    if(partial) { tx.set_byte_enable_ptr(be); tx.set_byte_enable_length(4); }
    auto id=++count;
    trace<<"{\"id\":"<<id<<",\"phase\":\"request\",\"ticks\":\""<<sc_time_stamp().value()<<"\",\"tick_fs\":\"1000\",\"address\":"<<address<<",\"write\":"<<(write?"true":"false")<<",\"data\":"<<data<<"}\n";
    socket->b_transport(tx,delay); wait(delay);
    trace<<"{\"id\":"<<id<<",\"phase\":\"response\",\"ticks\":\""<<sc_time_stamp().value()<<"\",\"tick_fs\":\"1000\",\"data\":"<<data<<",\"status\":"<<int(tx.get_response_status())<<"}\n";
    return tx.is_response_ok();
  }
  void run() {
    target.reset();
    uint32_t d=0x12345678; ok &= access(true,0,d);
    d=0; ok &= access(false,0,d) && d==0x12345678;
    d=0xaabbccdd; ok &= access(true,0,d,true);
    d=0; ok &= access(false,0,d) && d==0x12bb56dd;
    d=0xfeedbeef; ok &= !access(false,32,d);
    target.reset(); d=~0u; ok &= access(false,0,d) && d==0;
    trace.flush();
    std::cout<<(ok?"SYSTEMC_ORACLE_PASS":"SYSTEMC_ORACLE_FAIL")<<" transactions="<<count<<" ticks="<<sc_time_stamp().value()<<std::endl;
    sc_stop();
  }
};
int sc_main(int argc,char** argv) {
  sc_set_time_resolution(1,SC_PS);
  bool corrupt=argc>1 && !strcmp(argv[1],"negative_control");
  bool slow=argc>1 && !strcmp(argv[1],"backpressure");
  Target target("memory",corrupt,slow); Initiator cpu("synthetic_initiator",target); cpu.socket.bind(target.socket);
  sc_start(); return cpu.ok?0:2;
}
