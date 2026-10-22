"""Decode actual CommMonitor logs. Pairing is DERIVED, not native transaction IDs."""
import re

def correlate(path):
    monitors={name:{'requests':[],'responses':[]} for name in ['before_tlm','after_tlm']}
    # Some upstream TlmBridge messages omit newlines; timestamps still delimit records.
    pattern=r'(\d+): system\.(before_tlm|after_tlm): (Forwarded|Received) (read|write) (request|response)'
    for match in re.finditer(pattern,path.read_text()):
        tick,name,direction,kind,phase=match.groups()
        monitors[name]['requests' if direction=='Forwarded' else 'responses'].append((int(tick),kind))
    before,after=monitors['before_tlm'],monitors['after_tlm']
    count=len(before['requests'])
    if not count or any(len(m[k])!=count for m in monitors.values() for k in ['requests','responses']): raise AssertionError('Unpaired TLM monitor traffic')
    result=[]
    for i in range(count):
        req,res=before['requests'][i],before['responses'][i]
        target_req,target_res=after['requests'][i],after['responses'][i]
        if len({req[1],res[1],target_req[1],target_res[1]})!=1: raise AssertionError('TLM traffic type/order mismatch')
        if not req[0]<=target_req[0]<=target_res[0]<=res[0]: raise AssertionError('TLM time ordering mismatch')
        result.append({'transaction_id':f'derived-seq-{i+1}','kind':req[1],'request_ticks':str(req[0]),'target_request_ticks':str(target_req[0]),'target_response_ticks':str(target_res[0]),'response_ticks':str(res[0]),'tick_fs':'1000','origin':'simulation_zero','correlation':'DERIVED_FIFO_SINGLE_OUTSTANDING_TIMING_CPU','address':None,'data':None})
    return result
