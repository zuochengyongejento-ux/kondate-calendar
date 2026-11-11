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

document.querySelector('header').insertAdjacentHTML('afterend','<p class="muted" id="appVersion">更新版：再登録対応 2</p>');
const GOOGLE_CLIENT_ID='763783247877-5q5kcvanaqhfh82iq1169alr66ferkq4.apps.googleusercontent.com';
const GOOGLE_SCOPE='https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/userinfo.email';
let googleSession=null, googleBusy=false;
const googleButton=$('google');
const authBox=document.createElement('div');
authBox.innerHTML='<label for="sourceLabel">献立の区分（学校・園など）</label><input id="sourceLabel" type="text" value="学校" maxlength="60"><p class="muted">同じ区分・日付・献立は再登録しません。区分や献立を変更すると別の予定になります。以前にICSや別アプリで登録した予定との重複は判定できません。</p><button id="connectGoogle" class="btn secondary wide">Googleアカウントを選ぶ</button><p id="googleAccount" class="status" role="status">未接続</p><button id="disconnectGoogle" class="btn secondary small hidden">接続を解除</button>';
googleButton.before(authBox);
const connectButton=$('connectGoogle');
function resetGoogle(){
 googleSession=null; googleButton.disabled=true;
 $('googleAccount').textContent='未接続';
 $('disconnectGoogle').classList.add('hidden');
}
function validGoogleDate(date){
 const d=new Date(date+'T00:00:00Z');
 return /^\d{4}-\d{2}-\d{2}$/.test(date)&&!isNaN(d)&&d.toISOString().slice(0,10)===date;
}
function googleEndDate(date){
 const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);
}
async function googleEventId(source,row){
 const bytes=new TextEncoder().encode(JSON.stringify(['kondate-v1',source.normalize('NFKC').trim(),row.date,clean(row.menu).normalize('NFKC')]));
 return 'kc'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}

async function insertGoogleMeal(session,body){
 const root='https://www.googleapis.com/calendar/v3/calendars/primary/events';
 const headers={Authorization:'Bearer '+session.token,'Content-Type':'application/json'};
 // Deleted event IDs remain reserved. Use a deterministic next generation only
 // after Google confirms deletion, so retries and concurrent tabs use the same ID.
 for(let generation=0;generation<100;generation++){
  const id=body.id+(generation?'r'+generation.toString(32):'');
  const inserted=await fetch(root,{method:'POST',headers,body:JSON.stringify({...body,id})});
  if(inserted.status!==409)return inserted;
  const existing=await fetch(root+'/'+encodeURIComponent(id),{headers:{Authorization:headers.Authorization}});
  if(existing.status===410)continue;
  if(!existing.ok)return existing; // An unreadable conflict is not a duplicate.
  const event=await existing.json();
  if(event.status==='cancelled')continue;
  if(event.status==='confirmed'||event.status==='tentative')return inserted;
  return {ok:false,status:502};
 }
 return {ok:false,status:409,conflictUnresolved:true};
}

function loadGoogleIdentity(){
 return new Promise((resolve,reject)=>{
  if(window.google?.accounts?.oauth2){resolve();return}
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
  script.onload=resolve;script.onerror=()=>reject(Error('Googleログインを読み込めませんでした。通信やブラウザの設定を確認してください。'));
  document.head.append(script);
 });
}
connectButton.disabled=true;
loadGoogleIdentity().then(()=>{connectButton.disabled=false}).catch(err=>{$('googleAccount').textContent=err.message});
connectButton.onclick=()=>{
 resetGoogle();
 const client=window.google.accounts.oauth2.initTokenClient({
  client_id:GOOGLE_CLIENT_ID,scope:GOOGLE_SCOPE,include_granted_scopes:false,
  error_callback:()=>{$('googleAccount').textContent='ログイン画面が閉じられたか開けませんでした。もう一度お試しください。'},
  callback:async response=>{
   if(response.error){$('googleAccount').textContent='接続できませんでした：'+response.error;return}
   if(!window.google.accounts.oauth2.hasGrantedAllScopes(response,...GOOGLE_SCOPE.split(' '))){
    $('googleAccount').textContent='登録に必要な権限が許可されていません。再度アカウントを選んで確認してください。';return;
   }
   try{
    const res=await fetch('https://www.googleapis.com/oauth2/v2/userinfo',{headers:{Authorization:'Bearer '+response.access_token}});
    if(!res.ok)throw Error('アカウント情報を確認できませんでした。');
    const info=await res.json();if(!info.email)throw Error('メールアドレスを確認できませんでした。');
    googleSession={token:response.access_token,email:info.email,expires:Date.now()+Number(response.expires_in||3600)*1000};
    $('googleAccount').textContent='登録先：'+info.email+' のメインカレンダー';
    googleButton.disabled=false;$('disconnectGoogle').classList.remove('hidden');
   }catch(err){resetGoogle();$('googleAccount').textContent=err.message}
  }
 });
 client.requestAccessToken({prompt:'select_account'});
};
$('disconnectGoogle').onclick=()=>{
 if(googleBusy)return;
 const token=googleSession?.token;resetGoogle();
 if(token)window.google.accounts.oauth2.revoke(token,()=>{});
};
googleButton.textContent='確認した献立をGoogleカレンダーに一括登録';
googleButton.onclick=async()=>{
 if(googleBusy)return;
 if(!googleSession||Date.now()>=googleSession.expires-30000){resetGoogle();$('exportStatus').textContent='Googleアカウントをもう一度選んでください。';return}
 sync();
 if(records.some(r=>!validGoogleDate(r.date)||!clean(r.menu))){$('exportStatus').textContent='日付が存在しない行や、献立が空の行を修正・削除してください。';return}
 const list=events().map(r=>({...r})), source=clean($('sourceLabel').value);
 if(!source){$('exportStatus').textContent='献立の区分を入力してください。';return}
 if(!list.length){$('exportStatus').textContent='登録対象の献立がありません。';return}
 const session={...googleSession};
 if(!window.confirm('登録先：'+session.email+' のメインカレンダー\n区分：'+source+'\n'+list.length+'件を終日の予定として追加します。\n年月・献立を確認しましたか？'))return;
 googleBusy=true;googleButton.disabled=true;connectButton.disabled=true;$('disconnectGoogle').disabled=true;
 let added=0,skipped=0,failed=0,processed=0,reason='';
 try{
  for(const row of list){
   if(Date.now()>=session.expires-30000){reason='接続の有効期限が切れました。再接続して再実行してください。';break}
   const body={id:await googleEventId(source,row),summary:menuTitle(row.menu),description:row.menu+'\n\n献立の区分：'+source,start:{date:row.date},end:{date:googleEndDate(row.date)},extendedProperties:{private:{app:'kondate-calendar',source}}};
   let res;
   try{res=await insertGoogleMeal(session,body)}
   catch{reason='通信が途切れました。結果不明の予定も含め、再実行すると重複を防いで再試行できます。';break}
   processed++;
   if(res.ok)added++;
   else if(res.status===409&&!res.conflictUnresolved)skipped++;
   else{
    failed++;reason='Googleへの登録に失敗しました（HTTP '+res.status+'）。';
    if(res.status===401){resetGoogle();reason+=' 再接続してください。';break}
    if(res.status===403||res.status===429)break;
   }
   $('exportStatus').textContent=processed+' / '+list.length+'件を処理中…';
  }
 }catch{reason='登録を中断しました。再実行して残りを登録できます。'}
 finally{
  googleBusy=false;connectButton.disabled=false;$('disconnectGoogle').disabled=false;googleButton.disabled=!googleSession;
  $('exportStatus').textContent='追加'+added+'件／登録済み'+skipped+'件／失敗'+failed+'件／未処理'+(list.length-processed)+'件'+(reason?'\n'+reason:'');
 }
};
