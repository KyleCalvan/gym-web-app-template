// @ts-nocheck
import { useState } from 'react';
import { Badge, TabbedCard, Modal, Field, Select } from '../shared';
import { peso } from '../data.ts';
import { motion } from 'framer-motion';

function MemberMembership({ members, setMembers, plans, setTransactions, currentUserId, today, toast }){
  const me = members.find(m => m.id === currentUserId) || members[0];
  const [showSwitch, setShowSwitch] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [picked, setPicked] = useState(me?.plan || 'Premium');
  const [method, setMethod] = useState('GCash');

  // Student Verification State
  const [showVerify, setShowVerify] = useState(false);
  const [verifyStep, setVerifyStep] = useState(1);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [formPreview, setFormPreview] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'None' | 'Pending' | 'Verified'>('None');

  const renew = () => {
    const plan = plans.find(p => p.name === me.plan);
    if (!plan) return;
    setTransactions(prev => [{
      id: 'TXN-' + (8821 + prev.length),
      member: me.name,
      type: 'Membership Renewal (' + me.plan + ')',
      amount: plan.price,
      method,
      date: today,
      status: 'Paid',
    }, ...prev]);
    toast('Membership renewed — ' + peso(plan.price));
    setShowRenew(false);
  };

  const switchPlan = (e) => {
    e.preventDefault();
    if (picked === me.plan) { toast('That is already your current plan'); return; }

    // Student plan check
    if (picked.toLowerCase().includes('student') && verificationStatus !== 'Verified') {
      setShowVerify(true);
      setShowSwitch(false);
      return;
    }

    const newPlan = plans.find(p => p.name === picked);
    setMembers(prev => prev.map(m => m.id === me.id ? {...m, plan: picked} : m));
    if (newPlan) {
      setTransactions(prev => [{
        id: 'TXN-' + (8821 + prev.length),
        member: me.name,
        type: 'Plan Switch → ' + picked,
        amount: newPlan.price,
        method,
        date: today,
        status: 'Paid',
      }, ...prev]);
    }
    toast('Switched to ' + picked + ' plan');
    setShowSwitch(false);
  };

  const handleFileUpload = (e, type: 'id' | 'form') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'id') setIdPreview(reader.result as string);
      else setFormPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const submitVerification = () => {
    setVerificationStatus('Pending');
    toast('Documents submitted. Pending admin review.');
    setShowVerify(false);
  };

  const isFrozen = me?.status === 'Frozen';

  return (
    <>
      <div className="plan-card featured" style={{marginBottom:22}}>
        <div className="eyebrow" style={{color:'var(--steel)'}}>Current Plan</div>
        <div className="price">{me?.plan || 'Premium'}</div>
        <div style={{fontSize:14.3, color:'var(--steel)'}}>Renews Sep 12, 2026 · {peso((plans.find(p=>p.name===me?.plan)||{}).price || 2499)}/mo</div>
        <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:12}}>
          <Badge status={me?.status || 'Active'} />
          {verificationStatus !== 'None' && (
            <Badge status={verificationStatus === 'Verified' ? 'Active' : 'Pending'} style={{backgroundColor:'var(--surface-2)', color:'var(--steel)', border:'1px solid var(--line)'}}>
              Student: {verificationStatus}
            </Badge>
          )}
        </div>
        {isFrozen && (
          <div style={{marginTop:12, padding:'10px 12px', background:'var(--surface-2)', borderRadius:'var(--radius)', fontSize:13.8, color:'var(--ink)'}}>
            Your membership is currently <b>frozen</b>. Renewal and plan switching are paused until an admin unfreezes your account.
          </div>
        )}
        <div style={{display:'flex', gap:8, marginTop:16}}>
          <button className="btn btn-signal btn-sm" onClick={()=>setShowRenew(true)} disabled={isFrozen}>Renew Now</button>
          <button className="btn btn-outline btn-sm" style={{color:'var(--ink)', borderColor:'var(--ink)'}} onClick={()=>setShowSwitch(true)} disabled={isFrozen}>Switch Plan</button>
        </div>
      </div>
      <TabbedCard label="Plans" title="Available Plans">
        <div className="grid grid-3">
          {plans.map(p=>{
            const isCurrent = p.name === me?.plan;
            const isStudent = p.name.toLowerCase().includes('student');
            return (
              <div className={"plan-card"+(p.featured?' featured':'')} key={p.name}>
                {p.featured && <span className="ribbon">Most Popular</span>}
                <h3 style={{fontSize:19.8}}>{p.name}</h3>
                {isStudent && <div style={{fontSize:12.1, color:'var(--signal)', fontWeight:600, marginBottom:4}}>STUDENT DISCOUNT</div>}
                <div className="price">{peso(p.price)}<span>/{p.period}</span></div>
                <ul>{p.perks.map((perk,i)=><li key={i}>✓ {perk}</li>)}</ul>
                <button className={"btn btn-sm btn-block "+(isCurrent?'btn-outline':'btn-signal')} disabled={isCurrent} onClick={()=>{setPicked(p.name); setShowSwitch(true);}}>
                  {isCurrent ? 'Current Plan' : 'Switch to ' + p.name}
                </button>
              </div>
            );
          })}
        </div>
      </TabbedCard>

      {showRenew && (
        <Modal title="Renew Membership" onClose={()=>setShowRenew(false)}>
          <p style={{fontSize:14.3, color:'var(--steel)', marginBottom:14}}>Renew your <b>{me?.plan}</b> plan. A paid transaction will be recorded.</p>
          <Field label="Payment Method">
            <Select value={method} onChange={setMethod}>
              <option>GCash</option><option>Card</option><option>Cash</option>
            </Select>
          </Field>
          <button className="btn btn-signal btn-block" onClick={renew}>Confirm Renewal — {peso((plans.find(p=>p.name===me?.plan)||{}).price || 0)}</button>
        </Modal>
      )}

      {showSwitch && (
        <Modal title="Switch Plan" onClose={()=>setShowSwitch(false)}>
          <form onSubmit={switchPlan}>
            <Field label="Pick a Plan">
              <select
                className="form-control"
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
              >
                {plans.length > 0 ? (
                  plans.map(p => <option key={p.name} value={p.name}>{p.name}</option>)
                ) : (
                  <option disabled>No plans available</option>
                )}
              </select>
            </Field>
            <Field label="Payment Method">
              <Select value={method} onChange={setMethod}>
                <option>GCash</option><option>Card</option><option>Cash</option>
              </Select>
            </Field>
            <button className="btn btn-signal btn-block" type="submit">Confirm Switch</button>
          </form>
        </Modal>
      )}

      {showVerify && (
        <Modal title="Student Discount Verification" onClose={()=>setShowVerify(false)}>
          <div style={{padding: '0 24px 24px'}}>
            <div style={{display:'flex', gap:8, marginBottom:20}}>
              {[1,2,3].map(s => (
                <div key={s} style={{
                  flex:1, height:4, borderRadius:2,
                  backgroundColor: s <= verifyStep ? 'var(--signal)' : 'var(--line)'
                }} />
              ))}
            </div>

            {verifyStep === 1 && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                <p style={{fontSize:15.4, color:'var(--steel)', marginBottom:16, lineHeight:1.5}}>Please upload a clear photo of your <b style={{color:'var(--ink)'}}>Student ID</b>.</p>
                <Field label="Student ID Image">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleFileUpload(e, 'id')}
                    style={{
                      fontSize: 17.6,
                      padding: '8px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  />
                </Field>
                {idPreview && <img src={idPreview} style={{width:'100%', maxHeight:200, objectFit:'contain', borderRadius:8, marginTop:12, border:'1px solid var(--line)'}} />}
                <button className="btn btn-signal btn-block" style={{marginTop:24, height: 48, fontSize: 17.6}} onClick={()=>setVerifyStep(2)} disabled={!idPreview}>Next Step</button>
              </motion.div>
            )}

            {verifyStep === 2 && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}}>
                <p style={{fontSize:15.4, color:'var(--steel)', marginBottom:16, lineHeight:1.5}}>Upload your <b style={{color:'var(--ink)'}}>Registration Form</b> or Certificate of Enrollment (PDF/Image).</p>
                <Field label="Registration Document">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => handleFileUpload(e, 'form')}
                    style={{
                      fontSize: 17.6,
                      padding: '8px',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  />
                </Field>
                {formPreview && <div style={{marginTop:12, padding:8, background:'var(--surface-2)', borderRadius:8, fontSize:14.3, textAlign:'center', border:'1px solid var(--line)'}}>
                  {formPreview.startsWith('data:application/pdf') ? 'PDF Document Uploaded' : <img src={formPreview} style={{width:'100%', maxHeight:200, objectFit:'contain'}} />}
                </div>}
                <div style={{display:'flex', gap:12, marginTop:24}}>
                  <button className="btn btn-outline btn-block" style={{height: 48, fontSize: 17.6}} onClick={()=>setVerifyStep(1)}>Back</button>
                  <button className="btn btn-signal btn-block" style={{height: 48, fontSize: 17.6}} onClick={()=>setVerifyStep(3)} disabled={!formPreview}>Next Step</button>
                </div>
              </motion.div>
            )}

            {verifyStep === 3 && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{textAlign:'center'}}>
                <div style={{fontSize:52.8, marginBottom:16}}>📝</div>
                <h3 style={{marginBottom:12, fontSize: 22}}>Review Your Documents</h3>
                <p style={{fontSize:15.4, color:'var(--steel)', marginBottom:24, lineHeight:1.5}}>Our team will review your student credentials. You will be notified once verified.</p>
                <div style={{display:'flex', gap:12, justifyContent:'center'}}>
                  <button className="btn btn-outline" style={{height: 48, fontSize: 17.6, padding: '0 24px'}} onClick={()=>setVerifyStep(2)}>Back</button>
                  <button className="btn btn-signal" style={{height: 48, fontSize: 17.6, padding: '0 24px'}} onClick={submitVerification}>Submit for Review</button>
                </div>
              </motion.div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

export default MemberMembership;