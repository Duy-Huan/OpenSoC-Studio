"""Actual Wellen reader with bounded signal/transition windows and integer ticks."""
import argparse
import hashlib
import json
from pathlib import Path
import pywellen

def window(path, start=0, end=None, ids=None):
    if path.stat().st_size > 512*1024**2: raise ValueError('Waveform exceeds reader quota')
    waveform=pywellen.Waveform(str(path))
    variables=waveform.all_vars()
    signals=[]; chosen=[]
    for var in variables[:4096]:
        identity=hashlib.sha256(var.full_name.encode()).hexdigest()[:24]
        signals.append({'id':identity,'name':var.full_name,'width':var.bitwidth})
        if ids and identity in ids: chosen.append((identity,var))
    if not ids:
        seen=set()
        for s,v in zip(signals,variables):
            if v.name in {'clk','clk_i','rst_ni','resetn','trap','tests_passed','mem_axi_awvalid','mem_axi_awready','mem_axi_awaddr','mem_axi_wdata','data_o','rtl_value','gate_value'} and v.name not in seen:
                chosen.append((s['id'],v));seen.add(v.name)
                if len(chosen)==8: break
    elif set(ids)-{identity for identity,_ in chosen}: raise ValueError('Signal ID not present in this trace')
    if end is None:
        clocks=[var for _,var in chosen if var.name in {'clk','clk_i'}]
        candidates=clocks or [var for _,var in chosen]
        boundaries=[]
        for var in candidates:
            signal=var.signal;low,high=0,len(signal)
            while low<high:
                mid=(low+high)//2
                if signal[mid][0]<start: low=mid+1
                else: high=mid
            if low<len(signal): boundaries.append(signal[min(low+128,len(signal)-1)][0])
        end=max(start+1,max(boundaries,default=start)+1)
    result=[]
    for identity,var in chosen[:8]:
        signal=var.signal; low,high=0,len(signal)
        while low<high:
            mid=(low+high)//2
            if signal[mid][0]<start: low=mid+1
            else: high=mid
        changes=[]; index=low
        while index<len(signal) and len(changes)<512:
            tick,value=signal[index]
            if tick>end: break
            changes.append([str(tick),str(value)]); index+=1
        truncated=index<len(signal) and signal[index][0]<=end
        initial=signal.value_at(start)
        result.append({'id':identity,'name':var.full_name,'width':var.bitwidth,'initial':None if initial is None else str(initial),'changes':changes,'truncated':truncated})
    units={'fs':1,'ps':1000,'ns':1000000,'us':1000000000,'ms':1000000000000,'s':1000000000000000}
    return {'reader':'pywellen 0.25.7','format':str(waveform.file_format),'tick_fs':str(waveform.timescale.factor*units[str(waveform.timescale.unit)]),'origin':'simulation_zero','start':str(start),'end':str(end),'signals':signals,'window':result,'mapping':'TRACE_EXACT_SOURCE_UNAVAILABLE'}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('path'); parser.add_argument('--start',type=int,default=0); parser.add_argument('--end',type=int); parser.add_argument('--ids',default=''); args=parser.parse_args()
    if args.start<0 or (args.end is not None and args.end<=args.start): raise ValueError('Invalid waveform time range')
    print(json.dumps(window(Path(args.path),args.start,args.end,args.ids.split(',') if args.ids else None)))
if __name__=='__main__': main()
