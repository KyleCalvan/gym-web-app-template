// @ts-nocheck
import { useState } from 'react';
import { StatTile, Badge, TabbedCard, Modal, Field, TextInput, Select } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-US', {month:'short', day:'2-digit', year:'numeric'});
};

function AdminPromotions({ promotions, setPromotions, plans, toast, addAudit }){
  const [form, setForm] = useState({
    title:'', discountType:'Percentage', discountValue:'', validFrom:'', validUntil:'',
    applicablePlan:'Any Plan', description:'', maxRedemptions:'', minSpend:'', code:'',
    imageUrl:'',
  });
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [pubForm, setPubForm] = useState({promoId:'', action:'Publish'});
  const [showCreate, setShowCreate] = useState(false);
  const [detailPromo, setDetailPromo] = useState(null);

  const togglePublish = (id) => {
    setPromotions(prev => prev.map(p => p.id===id ? {...p, status: p.status==='Published' ? 'Draft' : 'Published'} : p));
    toast('Promotion status updated');
  };

  const submitNew = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.validFrom || !form.validUntil) { toast('Title and validity dates required'); return; }
    const id = 'PROMO-0' + (promotions.length + 1);
    const fromISO = new Date(form.validFrom);
    const untilISO = new Date(form.validUntil);
    const validFrom = isNaN(fromISO) ? form.validFrom : formatDate(form.validFrom);
    const validUntil = isNaN(untilISO) ? form.validUntil : formatDate(form.validUntil);
    const newPromo = {
      id, title: form.title.trim(),
      discountType: form.discountType, discount: form.discountValue || 'Custom',
      validFrom, validUntil, plan: form.applicablePlan,
      code: form.code || ('AUTO' + Date.now().toString().slice(-5)),
      maxRedemptions: Number(form.maxRedemptions) || 0,
      redemptions: 0,
      minSpend: Number(form.minSpend) || 0,
      status: 'Draft',
      imageUrl: form.imageUrl.trim() || '/gym-interior.jpg',
    };
    setPromotions(prev => [...prev, newPromo]);
    toast('Promotion created — ' + newPromo.title);
    addAudit?.('info', 'Promotion created', newPromo.title + ' (' + id + ')');
    setForm({title:'', discountType:'Percentage', discountValue:'', validFrom:'', validUntil:'', applicablePlan:'Any Plan', description:'', maxRedemptions:'', minSpend:'', code:'', imageUrl:''});
    setShowCreate(false);
  };

  const startEdit = (p) => {
    setEditing(p);
    setEditForm({title:p.title, discountType:p.discountType, discount:p.discount, code:p.code, validUntil:p.validUntil, imageUrl: p.imageUrl || ''});
  };
  const submitEdit = (e) => {
    e.preventDefault();
    setPromotions(prev => prev.map(p => p.id===editing.id ? {...p, ...editForm} : p));
    toast('Promotion updated — ' + editForm.title);
    addAudit?.('info', 'Promotion updated', editForm.title + ' (' + editing.id + ')');
    setEditing(null); setEditForm(null);
  };

  const applyPub = () => {
    if (!pubForm.promoId) { toast('Pick a promotion'); return; }
    const target = promotions.find(p => p.id === pubForm.promoId);
    if (!target) return;
    const nextStatus = pubForm.action === 'Publish' ? 'Published' : 'Draft';
    setPromotions(prev => prev.map(p => p.id===pubForm.promoId ? {...p, status:nextStatus} : p));
    toast(pubForm.action + ' applied to ' + target.title);
    addAudit?.('info', pubForm.action === 'Publish' ? 'Promotion published' : 'Promotion unpublished', target.title);
  };

  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <StatTile label="Total Promotions" value={promotions.length} />
        <StatTile label="Published" value={promotions.filter(p=>p.status==='Published').length} tone="court" />
        <StatTile label="Drafts" value={promotions.filter(p=>p.status==='Draft').length} tone="amber" />
        <StatTile label="Total Redemptions" value={promotions.reduce((a,p)=>a+p.redemptions,0)} tone="steel" />
      </div>

      <TabbedCard
        label="Operations"
        title="Promotion Resources"
        right={<div style={{display:'flex', gap:8}}><button className="btn btn-outline btn-sm" onClick={()=>setShowCreate(true)}>+ New Promotion</button></div>}
      >
        {promotions.length === 0 ? (
          <div style={{fontSize:13, color:'var(--steel)', padding:'10px 0'}}>
            No promotion resources yet. Click <b>+ New Promotion</b> to add the first one.
          </div>
        ) : (
          <div className="resource-grid">
            {promotions.map(p=>(
              <div className="resource-card" key={p.id} onClick={()=>setDetailPromo(p)}>
                <div
                  className="thumb"
                  style={{ backgroundImage: 'url(' + (p.imageUrl || '/gym-interior.jpg') + ')' }}
                  aria-hidden="true"
                />
                <div className="head">
                  <div>
                    <div className="ttl">{p.title}</div>
                    <div className="mono" style={{fontSize:10.5, color:'var(--steel)', marginTop:2}}>{p.id} · {p.code}</div>
                  </div>
                  <Badge status={p.status}/>
                </div>
                <div className="desc">{p.discount} off · {p.plan}</div>
                <div className="meta">
                  <span className="pill">{p.discount}</span>
                  <span className="pill">{p.plan}</span>
                  <span className="pill">{p.redemptions}/{p.maxRedemptions} used</span>
                </div>
                <div className="foot">
                  <span>Valid until {p.validUntil}</span>
                  <span className="open">See Resources →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabbedCard>

      <div style={{height:18}}></div>

      <TabbedCard label="Operations" title="Bulk Publish / Unpublish">
        <div className="grid grid-3">
          <Field label="Promotion">
            <Select value={pubForm.promoId} onChange={v=>setPubForm(f=>({...f, promoId:v}))}>
              <option value="">Select…</option>
              {promotions.map(p=><option key={p.id} value={p.id}>{p.title} ({p.status})</option>)}
            </Select>
          </Field>
          <Field label="Action">
            <Select value={pubForm.action} onChange={v=>setPubForm(f=>({...f, action:v}))}>
              <option>Publish</option><option>Unpublish</option>
            </Select>
          </Field>
          <div style={{display:'flex', alignItems:'flex-end'}}>
            <button className="btn btn-signal btn-sm" onClick={applyPub}>Apply</button>
          </div>
        </div>
      </TabbedCard>

      {detailPromo && (
        <Modal title={detailPromo.title} onClose={()=>setDetailPromo(null)} wide>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
            <div>
              <div className="eyebrow">Promotion</div>
              <div className="mono" style={{fontSize:13, marginTop:2}}>{detailPromo.id} · {detailPromo.code}</div>
            </div>
            <Badge status={detailPromo.status}/>
          </div>
          <div className="resource-detail-row"><span className="lbl">Discount</span><span className="val">{detailPromo.discount} {detailPromo.discountType ? `(${detailPromo.discountType})` : ''}</span></div>
          <div className="resource-detail-row"><span className="lbl">Applicable Plan</span><span className="val">{detailPromo.plan}</span></div>
          <div className="resource-detail-row"><span className="lbl">Valid From</span><span className="val">{detailPromo.validFrom}</span></div>
          <div className="resource-detail-row"><span className="lbl">Valid Until</span><span className="val">{detailPromo.validUntil}</span></div>
          <div className="resource-detail-row"><span className="lbl">Min. Spend</span><span className="val">₱{detailPromo.minSpend?.toLocaleString('en-PH') || 0}</span></div>
          <div className="resource-detail-row"><span className="lbl">Redemptions</span><span className="val">{detailPromo.redemptions} / {detailPromo.maxRedemptions}</span></div>
          <div style={{display:'flex', gap:8, marginTop:18}}>
            <button className="btn btn-outline btn-sm" onClick={()=>{startEdit(detailPromo); setDetailPromo(null);}}>Edit</button>
            <button className="btn btn-signal btn-sm" onClick={()=>{togglePublish(detailPromo.id); setDetailPromo(p=>({...p, status: p.status==='Published'?'Draft':'Published'}));}}>
              {detailPromo.status === 'Published' ? 'Unpublish' : 'Publish'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setDetailPromo(null)}>Close</button>
          </div>
        </Modal>
      )}

      {showCreate && (
        <Modal title="New Promotion" onClose={()=>setShowCreate(false)} wide>
          <form onSubmit={submitNew}>
            <div className="grid grid-3">
              <Field label="Promotion Title *"><TextInput required placeholder="e.g. Summer Body Special" value={form.title} onChange={v=>setForm(f=>({...f, title:v}))} /></Field>
              <Field label="Discount Type">
                <Select value={form.discountType} onChange={v=>setForm(f=>({...f, discountType:v}))}>
                  <option>Percentage</option><option>Fixed Amount</option><option>Bundle</option>
                </Select>
              </Field>
              <Field label="Discount Value"><TextInput placeholder="20% or ₱500" value={form.discountValue} onChange={v=>setForm(f=>({...f, discountValue:v}))} /></Field>
            </div>
            <div className="grid grid-3">
              <Field label="Valid From *"><TextInput type="date" required value={form.validFrom} onChange={v=>setForm(f=>({...f, validFrom:v}))} /></Field>
              <Field label="Valid Until *"><TextInput type="date" required value={form.validUntil} onChange={v=>setForm(f=>({...f, validUntil:v}))} /></Field>
              <Field label="Applicable Plan">
                <Select value={form.applicablePlan} onChange={v=>setForm(f=>({...f, applicablePlan:v}))}>
                  <option>Any Plan</option>
                  {plans.map(p=><option key={p.name}>{p.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Description"><textarea className="form-control" rows="2" placeholder="Short description shown to members…" value={form.description} onChange={e=>setForm(f=>({...f, description:e.target.value}))} /></Field>
            <Field label="Promotion Image">
              <div
                className="dropzone"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag'); }}
                onDragLeave={(e) => e.currentTarget.classList.remove('drag')}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag');
                  const file = e.dataTransfer.files?.[0];
                  if (file) onPickImage(file, url => setForm(f => ({ ...f, imageUrl: url })), toast);
                }}
                onClick={() => document.getElementById('promo-image-input-create')?.click()}
                style={{ backgroundImage: form.imageUrl ? `url(${form.imageUrl})` : 'none' }}
              >
                {!form.imageUrl && <span className="dropzone-hint">Drop an image here, click to browse, or paste a URL below</span>}
              </div>
              <input
                id="promo-image-input-create"
                type="file" accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onPickImage(file, url => setForm(f => ({ ...f, imageUrl: url })), toast);
                  e.target.value = '';
                }}
              />
              <div className="field-spacer" />
              <input
                className="form-control"
                placeholder="…or paste an image URL"
                value={form.imageUrl && !form.imageUrl.startsWith('data:') ? form.imageUrl : ''}
                onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
              />
            </Field>
            <div className="grid grid-3">
              <Field label="Max Redemptions"><TextInput type="number" placeholder="100" value={form.maxRedemptions} onChange={v=>setForm(f=>({...f, maxRedemptions:v}))} /></Field>
              <Field label="Min. Spend"><TextInput type="number" placeholder="0" value={form.minSpend} onChange={v=>setForm(f=>({...f, minSpend:v}))} /></Field>
              <Field label="Promo Code"><TextInput placeholder="SUMMER20" value={form.code} onChange={v=>setForm(f=>({...f, code:v}))} /></Field>
            </div>
            <div style={{display:'flex', gap:8}}>
              <button className="btn btn-signal" type="submit">Save Promotion</button>
              <button className="btn btn-outline" type="button" onClick={()=>setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {editing && editForm && (
        <Modal title="Edit Promotion" onClose={()=>{setEditing(null); setEditForm(null);}} wide>
          <form onSubmit={submitEdit}>
            <Field label="Title"><TextInput required value={editForm.title} onChange={v=>setEditForm(f=>({...f, title:v}))} /></Field>
            <Field label="Discount Type">
              <Select value={editForm.discountType} onChange={v=>setEditForm(f=>({...f, discountType:v}))}>
                <option>Percentage</option><option>Fixed Amount</option><option>Bundle</option>
              </Select>
            </Field>
            <Field label="Discount"><TextInput value={editForm.discount} onChange={v=>setEditForm(f=>({...f, discount:v}))} /></Field>
            <Field label="Promo Code"><TextInput value={editForm.code} onChange={v=>setEditForm(f=>({...f, code:v}))} /></Field>
            <Field label="Promotion Image">
              <div
                className="dropzone"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag'); }}
                onDragLeave={(e) => e.currentTarget.classList.remove('drag')}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('drag');
                  const file = e.dataTransfer.files?.[0];
                  if (file) onPickImage(file, url => setEditForm(f => ({ ...f, imageUrl: url })), toast);
                }}
                onClick={() => document.getElementById('promo-image-input-edit')?.click()}
                style={{ backgroundImage: editForm.imageUrl ? `url(${editForm.imageUrl})` : 'none' }}
              >
                {!editForm.imageUrl && <span className="dropzone-hint">Drop an image here, click to browse, or paste a URL below</span>}
              </div>
              <input
                id="promo-image-input-edit"
                type="file" accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onPickImage(file, url => setEditForm(f => ({ ...f, imageUrl: url })), toast);
                  e.target.value = '';
                }}
              />
              <div className="field-spacer" />
              <input
                className="form-control"
                placeholder="…or paste an image URL"
                value={editForm.imageUrl && !editForm.imageUrl.startsWith('data:') ? editForm.imageUrl : ''}
                onChange={e => setEditForm(f => ({ ...f, imageUrl: e.target.value }))}
              />
            </Field>
            <Field label="Valid Until"><TextInput type="date" value={editForm.validUntil} onChange={v=>setEditForm(f=>({...f, validUntil:v}))} /></Field>
            <button className="btn btn-signal btn-block" type="submit">Save Changes</button>
          </form>
        </Modal>
      )}
    </>
  );
}

export default AdminPromotions;