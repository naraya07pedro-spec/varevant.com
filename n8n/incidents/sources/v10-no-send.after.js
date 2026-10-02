
const x=$json||{};
return {json:{
  ...x,
  execution_result:'NO_SEND',
  gmail_attempted:false,
  diagnostic_message:
    x.reason==='SENDER_BUDGET_EXHAUSTED'
      ? `No send: sender cap reached. Last hour=${x.sent_last_hour||0}, rolling24h=${x.sent_last_24h||0}.`
      : 'No send: no queued candidate currently passes local-time + exact identity + suppression/history gates.',
  finished_at:new Date().toISOString()
}};
