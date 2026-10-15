"""Read original supplier workbooks; never alter SKUs or apply HCI discounts to other suppliers."""
import hashlib,json,sys
from pathlib import Path
import openpyxl

source_dir=Path(sys.argv[1]);out=Path(__file__).resolve().parents[1]/'src'/'suppliers';out.mkdir(exist_ok=True)
def source(path,sheet,basis):
 return {'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sheet':sheet,'basis':basis}
def write(name,value):
 (out/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

p=source_dir/'Rythern Master Price Sheet.xlsx';sheet='MASTER PRICE SHEET';w=openpyxl.load_workbook(p,data_only=True,read_only=True)
data={'supplier':'rythern','label':'Rythern','basis':'September 2026 DDP prices','lines':[['SW / SG','Rythern',2]],'families':['Framed'],'autoToe':False,'countsVerified':False,'source':source(p,sheet,'DDP column I only; FOB excluded'),
 'specifications':['MDF','Birch-veneer plywood; rubberwood face frame','18 mm birch-veneer plywood','Boke hardware; hinge specification not provided','Rubberwood; 9 mm birch-veneer plywood bottom','Boke hardware; runner specification not provided'], 'Rythern':[]}
for n,r in enumerate(w[sheet].values,1):
 if isinstance(r[6],str) and isinstance(r[8],(int,float)):
  data['Rythern'].append([r[6],r[6],r[8],None,None,0,0,0,None,None,f'{p.name} | {sheet}!I{n}','DDP September 2026'])
unique={}
for row in data['Rythern']:
 if row[0] in unique:
  assert unique[row[0]][2]==row[2], 'Conflicting prices for '+row[0]
  unique[row[0]][10]+='; '+row[10]
 else:unique[row[0]]=row
data['Rythern']=list(unique.values())
write('rythern',data)

p=source_dir/'US_Cabinet_Depot_Master (1).xlsx';sheet='USCD Portal Pricing';w=openpyxl.load_workbook(p,data_only=True,read_only=True)
data={'supplier':'uscd','label':'U.S. Cabinet Depot','basis':'Captured portal purchase prices; freight separate','lines':[],'families':[],'autoToe':False,'countsVerified':True,'source':source(p,sheet,'Captured purchase prices; no HCI factor'), 'specifications':['Per selected USCD product specification']*6}
groups={}
for n,r in enumerate(w[sheet].values,1):
 if isinstance(r[0],str) and isinstance(r[5],(int,float)):
  key=(r[2],r[3]);group=groups.setdefault(key,[])
  assembly=r[7] if isinstance(r[7],(int,float)) else (r[5] if r[10]==0 else None)
  group.append([r[0],r[1] or r[0],r[5],assembly,None,r[10] if isinstance(r[10],(int,float)) else 0,0,r[8] if isinstance(r[8],(int,float)) else 0,None,None,f'{p.name} | {sheet}!F{n}', 'Portal captured '+str(r[17]),{'url':r[16],'assemblyFee':r[6] if isinstance(r[6],(int,float)) else None,'baseSku':r[4],'category':r[11],'hardwareBasis':r[9],'notes':r[12]}])
for i,((family,finish),rows) in enumerate(sorted(groups.items())):
 key='Group'+str(i);data[key]=rows
 data['lines'].append([finish+' (RTA)',key,2]);data['families'].append(family)
 if family in ['Framed','Frameless']:
  data['lines'].append([finish+' (Assembled)',key,3]);data['families'].append(family)
write('uscd',data)
options=[]
for n,r in enumerate(w['USCD Options'].values,1):
 if n>5 and isinstance(r[1],str) and isinstance(r[3],(int,float)):
  options.append({'key':r[0],'sku':r[1],'description':r[2],'purchase':r[3],'type':r[4],'source_id':str(r[5]),'source_url':r[6],'source_row':n})
write('uscd-options',{'source':source(p,'USCD Options','Observed additional option prices'),'options':options})
print('Imported Rythern DDP and USCD purchase catalogs with original SKU strings and source references.')
