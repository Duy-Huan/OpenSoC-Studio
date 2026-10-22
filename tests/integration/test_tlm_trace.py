import pytest
from workers.runtime.tlm_trace import correlate

TRACE='''0: system.from_tlm: register non-blocking interface      0: system.before_tlm: Forwarded write request
8000: system.after_tlm: Forwarded write request
66000: system.after_tlm: Received write response
66000: system.before_tlm: Received write response
'''

def test_trace_handles_upstream_merged_records_and_preserves_derived_identity(tmp_path):
    path=tmp_path/'bridge.log';path.write_text(TRACE)
    item=correlate(path)[0]
    assert item['request_ticks']=='0' and item['target_request_ticks']=='8000' and item['response_ticks']=='66000'
    assert item['correlation'].startswith('DERIVED') and item['data'] is None and item['address'] is None

@pytest.mark.parametrize('text',[TRACE.replace('66000: system.before_tlm: Received write response',''),TRACE.replace('8000: system.after_tlm','70000: system.after_tlm'),TRACE.replace('Forwarded write request\n8000','Forwarded read request\n8000')])
def test_trace_rejects_missing_response_bad_order_or_type(tmp_path,text):
    path=tmp_path/'bridge.log';path.write_text(text)
    with pytest.raises(AssertionError): correlate(path)
