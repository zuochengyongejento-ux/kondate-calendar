const $=id=>document.getElementById(id);
let records=[];
const pad=n=>String(n).padStart(2,'0');
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// School schedule annotations printed inside the menu column are not dishes.
const schoolNote=/(?:[１-６1-6]\s*年\s*)?(?:修学旅行|校外学習|社会科見学|遠足|宿泊学習|林間学校|運動会|授業参観|学校公開|職場体験|学年行事|給食なし|弁当の日)/g;
const removeSchoolNotes=s=>clean(s.replace(schoolNote,'').replace(/[（）()【】]/g,' '));
function menuTitle(menu){
 // Preserve dish boundaries before normalizing whitespace; PDF text may wrap a dish.
 const dishes=String(menu||'').replace(/^(?:給食\s*[:：]\s*)/,'')
  .split(/\s*(?:[/／]|\r?\n|、|，|・)\s*/)
  .map(s=>removeSchoolNotes(s).replace(/\s+/g,'')).filter(Boolean);
 for(let i=0;i<dishes.length-1;i++){
  if(/(?:風|ふう)$/.test(dishes[i])&&/^(?:まぜごはん|混ぜご飯|ごはん|ご飯|ライス|うどん|やきそば)/.test(dishes[i+1])){
   dishes.splice(i,2,dishes[i]+dishes[i+1]);
  }
 }
 const drink=/^(?:牛乳|ぎゅうにゅう|ミルク|お茶)$/;
 const side=/(?:サラダ|さらだ|スープ|すーぷ|汁|じる|和え|あえ|おひたし|お浸し|ナムル|ゼリー|ヨーグルト|プリン)/;
 // Choose a dish that helps avoid repeating lunch at dinner.
 const plainStaple=/^(?:(?:白|しろ|むぎ|麦|雑穀|ざっこく|玄米)?(?:ごはん|ご飯|御飯)|ライス|.*(?:パン|ぱん|コッペ|コッぺ|ロール)|パーカーハウス)$/;
 const cookedStaple=/(?:チャーハン|ちゃーはん|炒飯|ピラフ|まぜごはん|混ぜご飯|たきこみ|炊き込み|ごもくごはん|五目|カレー|丼|どんぶり|うどん|そば|ソバ|ラーメン|らーめん|スパゲ|パスタ|ビーフン|サンド|ホットドッグ|ピザ)/;
 const main=/(?:ハンバーグ|コロッケ|からあげ|唐揚|から揚|フライ|カツ|かつ|焼き|やき|焼|煮|シューマイ|しゅうまい|ギョーザ|ぎょうざ|餃子|オムレツ|麻婆|マーボー|ポークビーンズ|はっぽうさい|タイピーエン|すきやき|にくじゃが|(?:みそ|おかか)に$)/;
 const candidates=dishes.filter(s=>!drink.test(s));
 const meals=candidates.filter(s=>!plainStaple.test(s)&&!side.test(s));
 const label=meals.find(s=>cookedStaple.test(s))
  ||meals.find(s=>main.test(s))
  ||meals[0]||candidates.find(s=>!plainStaple.test(s))||candidates[0]||'';
 return '🍚 給食：'+(Array.from(label).slice(0,18).join('')||'献立');
}
function rowHtml(r,i){return `<div class="day" data-index="${i}"><div class="dayhead"><b>${i+1}件目</b><button class="btn secondary small" data-remove="${i}">削除</button></div><div class="fields"><div><label>日付</label><input type="date" data-field="date" value="${escape(r.date)}"></div><div><label>献立の詳細（すべて記載）</label><textarea data-field="menu">${escape(r.menu)}</textarea><div class="muted" style="margin-top:6px">予定タイトル：<span data-preview>${escape(menuTitle(r.menu))}</span></div></div></div></div>`}
function sync(){document.querySelectorAll('.day').forEach(el=>{const i=Number(el.dataset.index);records[i]={date:el.querySelector('[data-field=date]').value,menu:el.querySelector('[data-field=menu]').value}})}
function render(){ $('days').innerHTML=records.map(rowHtml).join('')||'<div class="muted">まだ献立がありません。PDFを選ぶか「日付を追加」を押してください。</div>';$('count').textContent=`${records.length}件の予定` }
$('days').addEventListener('input',e=>{sync();const day=e.target.closest('.day');if(day){day.querySelector('[data-preview]').textContent=menuTitle(records[Number(day.dataset.index)].menu)}});$('days').addEventListener('click',e=>{const b=e.target.closest('[data-remove]');if(!b)return;sync();records.splice(+b.dataset.remove,1);render()});
$('addDay').onclick=()=>{sync();const y=+$('year').value,m=+$('month').value;records.push({date:`${y}-${pad(m)}-01`,menu:''});render()};
$('clearDays').onclick=()=>{records=[];render()};
function pdfRows(items){const byPage=[];for(const it of items){let pg=byPage[it.page]??(byPage[it.page]=[]);pg.push(it)}return byPage.flatMap(pg=>{if(!pg)return[];pg.sort((a,b)=>b.y-a.y||a.x-b.x);let lines=[];for(const t of pg){let line=lines.find(l=>Math.abs(l.y-t.y)<3.5);if(!line){line={y:t.y,items:[]};lines.push(line)}line.items.push(t)}return lines.sort((a,b)=>b.y-a.y).map(l=>({y:l.y,items:l.items.sort((a,b)=>a.x-b.x)}))})}
// This school table has separate staple, drink, dish and ingredient columns.
function extractSchoolTable(lines){
 const items=lines.flatMap(l=>l.items), heading=items.find(t=>t.str.replace(/\s/g,'')==='おかず');
 if(!heading)return null;
 const scale=heading.x/160.9;
 if(!items.some(t=>/チャーハン|ごはん|パン/.test(t.str)&&t.x>58*scale&&t.x<99*scale))return null;
 const year=+$('year').value,month=+$('month').value,out=[];
 const pages=[...new Set(items.map(t=>t.page))];
 for(const page of pages){
  const pageLines=lines.filter(l=>l.items[0]?.page===page);
  const dates=items.filter(t=>t.page===page&&t.x>35*scale&&t.x<47*scale&&/^(?:[1-9]|[12]\d|3[01])$/.test(t.str.trim()))
   .filter(t=>items.some(w=>w.page===page&&w.x>=47*scale&&w.x<58*scale&&Math.abs(w.y-t.y)<5*scale&&/^[月火水木金土日]$/.test(w.str.trim())))
   .map(t=>({day:+t.str,y:t.y})).sort((a,b)=>b.y-a.y);

  for(let i=0;i<dates.length;i++){
   const d=dates[i],top=i?(dates[i-1].y+d.y)/2:d.y+18*scale;
   const bottom=i+1<dates.length?(d.y+dates[i+1].y)/2:d.y-20*scale;
   const band=pageLines.filter(l=>l.y<=top&&l.y>bottom);
   const column=(lo,hi)=>band.map(l=>removeSchoolNotes(l.items.filter(t=>t.x>=lo*scale&&t.x<hi*scale).map(t=>t.str).join('')).replace(/\s+/g,'')).filter(Boolean);
   const staple=column(58,99).join('');
   const dishes=column(126,217).filter(t=>!/^【?代[:：]/.test(t)&&!/[『』]|献立|ひこんだて/.test(t));
   if(!staple&&!dishes.length)continue;
   if(/文化の日|感謝の日|振替休日|祝日/.test(staple+dishes.join('')))continue;
   out.push({date:`${year}-${pad(month)}-${pad(d.day)}`,menu:[staple,'牛乳',...dishes].filter(Boolean).join(' / ')});
  }
 }
 return out;
}
function extract(lines){const school=extractSchoolTable(lines);if(school!==null)return school;const year=+$('year').value,month=+$('month').value;let rows=[],active=null;const flush=()=>{if(active&&active.lines.length){const text=active.lines.map(a=>clean(a)).filter(Boolean).join(' / ');if(text&&!/^(文化の日|感謝の日|振替休日|祝日)$/.test(text))rows.push({date:`${year}-${pad(month)}-${pad(active.day)}`,menu:text})}};
 for(const line of lines){const items=line.items.filter(t=>clean(t.str));if(!items.length)continue;
  const left=items.filter(t=>t.x<90).map(t=>clean(t.str)).join(' ');
  const dateMatch=left.match(/(?:^|\s)([1-9]|[12]\d|3[01])\s*(?:月|火|水|木|金|土|日)(?:\s|$)/) || (items.some(t=>t.x<95)&&left.match(/^([1-9]|[12]\d|3[01])\s*$/));
  if(dateMatch){const day=Number(dateMatch[1]);if(active?.day!==day){flush();active={day,lines:[]}}}
  if(active){const menuItems=items.filter(t=>t.x>=92&&t.x<360);let menu=removeSchoolNotes(clean(menuItems.map(t=>t.str).join(' ')));menu=menu.replace(/ぎゅうにゅう|牛乳/g,'').trim();if(menu&&!/^(魚・肉|主食|飲物|献立名|【代】)/.test(menu))active.lines.push(menu)}
 }flush();const uniq=new Map();for(const r of rows){if(!uniq.has(r.date))uniq.set(r.date,r)}return [...uniq.values()];}
async function readPdf(file){const pdfjs=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';let doc=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;let all=[];for(let page=1;page<=doc.numPages;page++){const p=await doc.getPage(page),content=await p.getTextContent();for(const it of content.items){if(!it.str)continue;all.push({page,x:it.transform[4],y:it.transform[5],str:it.str})}}return {pages:doc.numPages,items:all}}
function detectPeriod(name,items){
 const normalized=name.normalize('NFKC');
 const filenameMonth=normalized.match(/(?:^|[^\d])(?:[0-9]{2,4}[.年_-])?\s*(1[0-2]|[1-9])月/);
 // Header-only extraction prevents "2日 月" from being mistaken for "2月".
 const top=items.filter(t=>t.page===1&&t.y>720).sort((a,b)=>b.y-a.y||a.x-b.x).map(t=>t.str).join(' ').normalize('NFKC');
 const headerMonth=top.match(/(?:^|[^\d])(1[0-2]|[1-9])\s*月\s*(?:よてい|予定|献立|こんだて)/);
 const yearText=(normalized+' '+top).match(/令和\s*([0-9]+)\s*年/);
 return {month:filenameMonth?+filenameMonth[1]:(headerMonth?+headerMonth[1]:null),year:yearText?2018+Number(yearText[1]):null};
}
$('file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;$('readStatus').textContent='PDFを読み取っています…';try{const result=await readPdf(f);if(!result.items.length)throw Error('画像だけのPDFか、文字情報がないPDFのようです。');const period=detectPeriod(f.name,result.items);if(period.year)$('year').value=period.year;if(period.month)$('month').value=period.month;const found=extract(pdfRows(result.items));records=found;render();$('readStatus').textContent=`${result.pages}ページから文字を取得しました。${found.length}日分の候補を表示しました。${period.month?'': 'PDFから月を確定できませんでした。月を確認してください。'}日付と献立が合っているか必ず確認・修正してください。${found.length===0?' このレイアウトにはまだ自動抽出が対応していません。':''}`;}catch(err){$('readStatus').textContent=`読み取りができませんでした：${err.message}。別のPDFを試すか、日付を手入力してください。`}});
for(const field of ['year','month'])$(field).addEventListener('change',()=>{sync();const y=Number($('year').value),m=Number($('month').value);if(y<2020||y>2100||m<1||m>12)return;records=records.map(r=>({...r,date:r.date.replace(/^\d{4}-\d{2}/,`${y}-${pad(m)}`)}));render()});
function events(){sync();return records.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&clean(r.menu)).filter(r=>!$('skipWeekend').checked||![0,6].includes(new Date(r.date+'T12:00:00').getDay())).map(r=>{let menu=r.menu;if($('skipSat').checked&&new Date(r.date+'T12:00:00').getDay()===6){menu=menu.split(/\s*[/／]\s*/).filter(s=>!/おやつ/.test(s)).join(' / ')}return {...r,menu}}).filter(r=>clean(r.menu))}
const icsEscape=s=>String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
$('ics').onclick=()=>{const list=events();if(!list.length){$('exportStatus').textContent='有効な日付と献立を入力してください。';return}let text='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Kondate Calendar//JP\r\nCALSCALE:GREGORIAN\r\n';for(const r of list){const dt=r.date.replace(/-/g,'');const end=new Date(r.date+'T12:00:00');end.setDate(end.getDate()+1);const dtEnd=`${end.getFullYear()}${pad(end.getMonth()+1)}${pad(end.getDate())}`;text+=`BEGIN:VEVENT\r\nUID:${dt}-${Math.random().toString(36).slice(2)}@kondate-calendar\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}\r\nDTSTART;VALUE=DATE:${dt}\r\nDTEND;VALUE=DATE:${dtEnd}\r\nSUMMARY:${icsEscape(menuTitle(r.menu))}\r\nDESCRIPTION:${icsEscape(r.menu)}\r\nEND:VEVENT\r\n`}text+='END:VCALENDAR\r\n';const blob=new Blob([text],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`kondate-${$('year').value}-${pad($('month').value)}.ics`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('exportStatus').textContent=`${list.length}件のカレンダーファイルを作成しました。Googleカレンダーのパソコン版で取り込めます。`};
render();
