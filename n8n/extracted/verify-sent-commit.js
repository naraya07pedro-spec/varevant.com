// Extracted from SANITIZED historical n8n source.
// Node: Verify SENT Commit (LANE-A)
// Mode: runOnceForEachItem
// n8n context variables are supplied by the node runner.

const row=$json||{};
const sd=$getWorkflowStaticData('global');
const ex=String($execution.id);
const rec=sd.varevantBranchAContext?.[ex]?.success?.['LANE-A']||{};
const norm=v=>String(v??'').trim();
const get=(names)=>{const keys=Object.keys(row);for(const n of names){const k=keys.find(x=>x.trim().toLowerCase()===n.toLowerCase());if(k!==undefined)return row[k];}return'';};
const status=norm(get(['Current Status']));
const claim=norm(get(['Claim Status']));
const id=norm(get(['Gmail Message ID']));
const thread=norm(get(['Gmail Thread ID']));
const lane=norm(get(['Sender Lane']));
const account=norm(get(['Sender Account']));
const rowNumber=norm(row.row_number||get(['row_number']));
const ok=Boolean(norm(rec.row_number)&&rowNumber===norm(rec.row_number)&&status==='SENT'&&claim==='COMPLETED'&&id===norm(rec.id)&&lane==='LANE-A'&&account==='sender@example.invalid'&&(!norm(rec.threadId)||thread===norm(rec.threadId)));
return {json:{...row,_expected:rec,_sheet_commit_ok:ok,_sheet_commit_reason:ok?'EXACT_ROW_COMMIT_VERIFIED':'EXACT_ROW_COMMIT_NOT_VERIFIED'}};
