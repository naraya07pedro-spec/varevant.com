// Extracted from SANITIZED historical n8n source.
// Node: Acquire Dispatcher Lease
// Mode: runOnceForAllItems
// n8n context variables are supplied by the node runner.

const sd=$getWorkflowStaticData('global');const now=Date.now();const ttl=75*60*1000;const current=sd.varevantDispatcherLease||null;const busy=current&&current.execution_id!==String($execution.id)&&Number(current.expires_at||0)>now;
if(!busy)sd.varevantDispatcherLease={execution_id:String($execution.id),acquired_at:new Date(now).toISOString(),expires_at:now+ttl};
return [{json:{_lease_granted:!busy,_lease_owner:busy?current.execution_id:String($execution.id),_lease_expires_at:new Date(busy?current.expires_at:now+ttl).toISOString(),branch:'A_DISPATCHER'}}];
