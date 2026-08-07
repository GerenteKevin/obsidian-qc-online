export function parseCsv(text:string){
 const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
 const clean=text.replace(/^\uFEFF/,'');
 for(let i=0;i<clean.length;i++){const c=clean[i];if(c==='"'){if(quoted&&clean[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if((c===','||c==='\t')&&!quoted){row.push(cell.trim());cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&clean[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell=''}else cell+=c}
 row.push(cell.trim());if(row.some(Boolean))rows.push(row);if(rows.length<2)return[];
 const headers=rows[0].map(x=>x.trim());return rows.slice(1).map(cols=>Object.fromEntries(headers.map((h,i)=>[h,cols[i]??''])));
}
export function toCsv(rows:Record<string,unknown>[]){if(!rows.length)return'';const heads=Object.keys(rows[0]);const esc=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`;return [heads.map(esc).join(','),...rows.map(r=>heads.map(h=>esc(r[h])).join(','))].join('\n')}
export function download(name:string,content:string,type='text/csv;charset=utf-8'){const blob=new Blob(['\uFEFF'+content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
