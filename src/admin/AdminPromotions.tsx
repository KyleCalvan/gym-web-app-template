// @ts-nocheck
import { useMemo, useState } from 'react';
import { Badge, TabbedCard, Modal, Field, TextInput, Select } from '../shared';
import { onPickImage } from '../shared/imageUpload.ts';
import { formatPromotionDate, formatPromotionDiscount } from '../member/promotionEligibility.ts';
import {
  createPromotion,
  deletePromotion as deletePromotionRequest,
  fetchPromotions,
  updatePromotion,
} from '../lib/api-client.ts';
import type { Promotion, ViewProps } from '../types.ts';

const formatDate = (value) => value ? formatPromotionDate(value) : '';
type PromotionFilter = 'all' | 'active' | 'scheduled' | 'expired' | 'draft';

function getPromotionBucket(promotion: Promotion, today: string): Exclude<PromotionFilter, 'all'> {
  if (promotion.status !== 'Published') return 'draft';
  if (promotion.validUntil < today) return 'expired';
  if (promotion.validFrom > today) return 'scheduled';
  return 'active';
}

function AdminPromotions({ promotions, setPromotions, plans, toast, addAudit }: Pick<ViewProps, 'promotions' | 'setPromotions' | 'plans' | 'toast' | 'addAudit'>) {
  const [form, setForm] = useState({
    title:'', discountType:'Percentage', discountValue:'', validFrom:'', validUntil:'',
    applicablePlan:'Any Plan', description:'', maxRedemptions:'', minSpend:'', code:'',
    imageUrl:'',
  });
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
  const [detailPromo, setDetailPromo] = useState(null);
  const [pendingDelete, setPendingDelete] = useState<Promotion | null>(null);
  const [filter, setFilter] = useState<PromotionFilter>('all');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.NEXT_PUBLIC_BOOKING_TIME_ZONE || 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const filteredPromotions = useMemo(
    () => promotions.filter((promotion) => filter === 'all' || getPromotionBucket(promotion, today) === filter),
    [promotions, filter, today],
  );

  const togglePublish = async (id) => {
    const current = promotions.find(p => p.id === id);
    const action = current && current.status === 'Published' ? 'draft' : 'publish';
    try {
      await updatePromotion(id, { action });
      setPromotions(await fetchPromotions());
      toast(action === 'publish' ? 'Promotion published' : 'Promotion moved to draft');
      addAudit?.('info', action === 'publish' ? 'Promotion published' : 'Promotion unpublished', current ? current.title : id);
    } catch (error) {
      toast('Could not update the promotion — ' + ((error && error.message) || 'request failed'));
    }
  };

  const submitNew = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.validFrom || !form.validUntil) { toast('Title and validity dates required'); return; }
    if (form.validFrom > form.validUntil) { toast('The end date must be on or after the start date'); return; }
    const code = form.code.trim().toUpperCase() || ('AUTO' + Date.now().toString().slice(-5));
    const discountType = form.discountType === 'Fixed Amount' ? 'Fixed' : form.discountType === 'Bundle' ? 'Bundle' : 'Percentage';
    const discountValue = Number(String(form.discountValue).replace(/[^0-9.]/g, '')) || 0;
    const planNames = form.applicablePlan && form.applicablePlan !== 'Any Plan' ? [form.applicablePlan] : [];
    try {
      await createPromotion({
        title: form.title.trim(),
        code,
        discountType,
        discountValue,
        validFrom: form.validFrom,
        validUntil: form.validUntil,
        description: form.description.trim() || null,
        planNames,
        minSpendCentavos: Math.round((Number(form.minSpend) || 0) * 100),
        maxRedemptions: Number(form.maxRedemptions) || null,
        imageUrl: form.imageUrl.trim() || null,
      });
      setPromotions(await fetchPromotions());
      toast('Promotion created — ' + form.title.trim());
      addAudit?.('info', 'Promotion created', form.title.trim() + ' (' + code + ')');
    } catch (error) {
      toast('Could not create the promotion — ' + ((error && error.message) || 'request failed'));
      return;
    }
    setForm({title:'', discountType:'Percentage', discountValue:'', validFrom:'', validUntil:'', applicablePlan:'Any Plan', description:'', maxRedemptions:'', minSpend:'', code:'', imageUrl:''});
    setShowCreate(false);
  };

  const startEdit = (p) => {
    setEditing(p);
    setEditForm({
      title:p.title,
      discountType:p.discountType,
      discount:p.discount,
      code:p.code,
      validFrom:p.validFrom,
      validUntil:p.validUntil,
      plan:p.plan,
      imageUrl: p.imageUrl || '',
    });
  };
  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editForm.title.trim() || !editForm.validFrom || !editForm.validUntil) { toast('Title and validity dates are required'); return; }
    if (editForm.validFrom > editForm.validUntil) { toast('The end date must be on or after the start date'); return; }
    try {
      await updatePromotion(editing.id, {
        title: String(editForm.title ?? '').trim() || undefined,
        description: String(editForm.description ?? '').trim() || null,
        discountValue: Number(String(editForm.discount ?? '').replace(/[^0-9.]/g, '')) || undefined,
        validFrom: editForm.validFrom,
        validUntil: editForm.validUntil,
        maxRedemptions: Number(editForm.maxRedemptions) || null,
        imageUrl: String(editForm.imageUrl ?? '').trim() || null,
      });
      setPromotions(await fetchPromotions());
    } catch (error) {
      toast('Could not save the promotion — ' + ((error && error.message) || 'request failed'));
      return;
    }
    toast('Promotion updated — ' + editForm.title);
    addAudit?.('info', 'Promotion updated', editForm.title + ' (' + editing.id + ')');
    setEditing(null); setEditForm(null);
  };

  ;

  const deletePromotion = async () => {
    if (!pendingDelete) return;
    try {
      await deletePromotionRequest(pendingDelete.id);
      setPromotions(await fetchPromotions());
    } catch (error) {
      toast('Could not delete the promotion — ' + ((error && error.message) || 'request failed'));
      return;
    }
    addAudit?.('warn', 'Promotion deleted', `${pendingDelete.title} (${pendingDelete.id})`);
    toast(`Promotion deleted — ${pendingDelete.title}`);
    setPendingDelete(null);
  };

  return (
    <>
      <div className="grid grid-4" style={{marginBottom:18}}>
        <div className="admin-promo-stat"><strong>{promotions.length}</strong><span>Total promotions</span></div>
        <div className="admin-promo-stat"><strong>{promotions.filter((p) => getPromotionBucket(p, today) === 'active').length}</strong><span>Active</span></div>
        <div className="admin-promo-stat"><strong>{promotions.filter((p) => getPromotionBucket(p, today) === 'scheduled').length}</strong><span>Scheduled</span></div>
        <div className="admin-promo-stat"><strong>{promotions.reduce((total, p) => total + p.redemptions, 0)}</strong><span>Redemptions</span></div>
      </div>

      <TabbedCard
        title="Promotion Resources"
        right={<div style={{display:'flex', gap:8}}><button className="btn btn-outline btn-sm" onClick={()=>setShowCreate(true)}>+ New Promotion</button></div>}
      >
        <div className="admin-promo-filters" role="group" aria-label="Filter promotions">
          {(['all', 'active', 'scheduled', 'expired', 'draft'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`admin-promo-filter${filter === option ? ' selected' : ''}`}
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
            >
              {option[0].toUpperCase() + option.slice(1)}
              <span>{option === 'all' ? promotions.length : promotions.filter((promotion) => getPromotionBucket(promotion, today) === option).length}</span>
            </button>
          ))}
        </div>
        {filteredPromotions.length === 0 ? (
          <div className="admin-promo-empty">
            {promotions.length === 0 ? (
              <>No promotions yet. Use <b>+ New Promotion</b> to add one.</>
            ) : <>No {filter === 'all' ? '' : `${filter} `}promotions match this filter.</>}
          </div>
        ) : (
          <div className="admin-promo-grid">
            {filteredPromotions.map((p) => {
              const bucket = getPromotionBucket(p, today);
              const plan = p.plan === 'Any' || p.plan === 'Any Plan' ? 'All plans' : p.plan;
              return (
                <article className="admin-promo-card" key={p.id}>
                  <header className="admin-promo-card-head">
                    <div><h3>{p.title}</h3><small>{p.id} · {p.code}</small></div>
                    <span className={`admin-promo-status status-${bucket}`}>{bucket}</span>
                  </header>
                  <div className="admin-promo-offer">
                    <strong>{formatPromotionDiscount(p)}</strong>
                    <span>{p.discountType} · {p.discount}</span>
                  </div>
                  <dl className="admin-promo-details">
                    <div><dt>Audience</dt><dd>Members</dd></div>
                    <div><dt>Applicable plans</dt><dd>{plan}</dd></div>
                    <div><dt>Starts</dt><dd>{formatDate(p.validFrom)}</dd></div>
                    <div><dt>Ends</dt><dd>{formatDate(p.validUntil)}</dd></div>
                  </dl>
                  <div className="admin-promo-card-foot">
                    <span>{p.redemptions} redeemed{Number(p.maxRedemptions) > 0 ? ` · ${p.maxRedemptions} max` : ''}</span>
                    <div className="admin-promo-card-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setDetailPromo(p)}>Details</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(p)}>Edit</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => togglePublish(p.id)}>{p.status === 'Published' ? 'Unpublish' : 'Publish'}</button>
                      <button type="button" className="btn btn-ghost btn-sm admin-promo-delete" onClick={() => setPendingDelete(p)}>Delete</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </TabbedCard>

      
      {detailPromo && (
        <Modal title={detailPromo.title} onClose={()=>setDetailPromo(null)} wide>
          {detailPromo.imageUrl ? (
            <img
              className="admin-promo-detail-image"
              src={detailPromo.imageUrl}
              alt={`${detailPromo.title} promotion`}
            />
          ) : (
            <div className="admin-promo-detail-image-empty">No promotion image set</div>
          )}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14}}>
            <div>
              <div className="mono" style={{fontSize:14.3, marginTop:2}}>{detailPromo.id} · {detailPromo.code}</div>
            </div>
            <Badge status={detailPromo.status}/>
          </div>
          <div className="resource-detail-row"><span className="lbl">Discount</span><span className="val">{detailPromo.discount} {detailPromo.discountType ? `(${detailPromo.discountType})` : ''}</span></div>
          <div className="resource-detail-row"><span className="lbl">Applicable Plan</span><span className="val">{detailPromo.plan}</span></div>
          <div className="resource-detail-row"><span className="lbl">Valid From</span><span className="val">{formatDate(detailPromo.validFrom)}</span></div>
          <div className="resource-detail-row"><span className="lbl">Valid Until</span><span className="val">{formatDate(detailPromo.validUntil)}</span></div>
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
        <Modal title="New Promotion" showCloseButton={false} onClose={()=>setShowCreate(false)} wide>
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
            <div className="grid grid-2">
              <Field label="Discount Type">
                <Select value={editForm.discountType} onChange={v=>setEditForm(f=>({...f, discountType:v}))}>
                  <option>Percentage</option><option>Fixed</option><option>Bundle</option>
                </Select>
              </Field>
              <Field label="Discount"><TextInput value={editForm.discount} onChange={v=>setEditForm(f=>({...f, discount:v}))} /></Field>
            </div>
            <div className="grid grid-2">
              <Field label="Promo Code"><TextInput value={editForm.code} onChange={v=>setEditForm(f=>({...f, code:v}))} /></Field>
              <Field label="Applicable Plan">
                <Select value={editForm.plan} onChange={v=>setEditForm(f=>({...f, plan:v}))}>
                  <option>Any Plan</option>
                  {plans.map(p=><option key={p.name}>{p.name}</option>)}
                </Select>
              </Field>
            </div>
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
            <div className="grid grid-2">
              <Field label="Valid From"><TextInput type="date" required value={editForm.validFrom} onChange={v=>setEditForm(f=>({...f, validFrom:v}))} /></Field>
              <Field label="Valid Until"><TextInput type="date" required value={editForm.validUntil} onChange={v=>setEditForm(f=>({...f, validUntil:v}))} /></Field>
            </div>
            <button className="btn btn-signal btn-block" type="submit">Save Changes</button>
          </form>
        </Modal>
      )}
      {pendingDelete && (
        <Modal title="Delete Promotion?" onClose={() => setPendingDelete(null)}>
          <p className="admin-promo-delete-copy">
            Delete <strong>{pendingDelete.title}</strong>? This removes the promotion from the admin list and member-facing offers.
          </p>
          <div className="admin-promo-confirm-actions">
            <button type="button" className="btn btn-outline" onClick={() => setPendingDelete(null)}>Keep promotion</button>
            <button type="button" className="btn btn-danger" onClick={deletePromotion}>Delete promotion</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default AdminPromotions;