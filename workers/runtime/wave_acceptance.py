"""Reader semantic fixtures, explicitly separate from CPU simulation evidence."""
import json
import time
from .runner import ROOT
from .wave import window

def main():
    folder=ROOT/'artifacts/runtime'/('wave-reader-'+str(time.time_ns()));folder.mkdir(parents=True)
    header='$timescale 1fs $end\n$scope module dut $end\n$var wire 1 ! state $end\n$upscope $end\n$enddefinitions $end\n'
    file=folder/'precision.vcd';tick=9007199254740993
    file.write_text(header+f'#5\nx!\n#{tick}\n1!\n#{tick+1}\nz!\n')
    index=window(file);identity=index['signals'][0]['id']
    assert window(file,0,4,[identity])['window'][0]['initial'] is None
    selected=window(file,tick-1,tick+2,[identity])
    assert selected['tick_fs']=='1'
    signal=selected['window'][0]
    assert signal['initial']=='x' and signal['changes']==[[str(tick),'1'],[str(tick+1),'z']]
    dense=folder/'dense.vcd';dense.write_text(header+''.join(f'#{i}\n{i%2}!\n' for i in range(2000)))
    bounded=window(dense,0,1999,[identity])['window'][0]
    assert bounded['truncated'] and len(bounded['changes'])==512
    automatic=window(dense,ids=[identity])
    assert automatic['end']=='129' and not automatic['window'][0]['truncated']
    try: window(file,0,10,['deadbeef'])
    except ValueError: pass
    else: raise AssertionError('Unknown signal must not silently map to another signal')
    (ROOT/'docs/test-evidence/runtime/wellen-reader-checks.json').write_text(json.dumps({'status':'PASS','scope':'Reader semantic fixtures, not hardware simulation','checks':['exact ticks beyond JS Number precision','X/Z preserved','missing initial sample stays unavailable','bounded transition windows','automatic window fits real changes','unknown signal rejection']},indent=2)+'\n')
    print('Wellen precision / X-Z / bounded window / identity checks: PASS')
if __name__=='__main__': main()
