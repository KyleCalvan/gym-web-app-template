import { useEffect, useState, type FormEvent } from 'react';
import { TabbedCard, Modal, Field, TextInput, Select } from '../shared';
import { peso } from '../data.ts';
import type { Plan, ViewProps } from '../types.ts';

interface PlanForm {
  name: string;
  price: string;
  cycle: string;
  perks: string;
}

interface PlanApiResponse {
  plans: Plan[];
  activePlanCount: number;
  maxActivePlans: number;
  error?: string;
  message?: string;
}

type PlanEditor = { mode: 'create' } | { mode: 'edit'; plan: Plan };

const EMPTY_FORM: PlanForm = { name: '', price: '', cycle: 'Monthly', perks: '' };

async function readPlanResponse(response: Response): Promise<PlanApiResponse> {
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object') throw new Error('The plan service returned an invalid response.');
  const payload = result as Partial<PlanApiResponse>;
  if (!response.ok) {
    throw new Error(payload.message ?? payload.error ?? 'The plan request failed.');
  }
  if (!Array.isArray(payload.plans)
    || !Number.isSafeInteger(payload.activePlanCount)
    || !Number.isSafeInteger(payload.maxActivePlans)) {
    throw new Error('The plan service returned incomplete plan-limit information.');
  }
  return payload as PlanApiResponse;
}

function AdminPlans({ plans, setPlans, toast }: Pick<ViewProps, 'plans' | 'setPlans' | 'toast'>) {
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [editingPlan, setEditingPlan] = useState<PlanEditor | null>(null);
  const [activePlanCount, setActivePlanCount] = useState(0);
  const [maxActivePlans, setMaxActivePlans] = useState(4);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serviceError, setServiceError] = useState('');

  // Compute active plan count from local plans as fallback / primary source
  const localActiveCount = plans.filter((p) => p.status === 'Active').length;

  useEffect(() => {
    let mounted = true;
    // Initialize with local count immediately
    setActivePlanCount(localActiveCount);
    fetch('/api/gym-plans')
      .then(readPlanResponse)
      .then((result) => {
        if (!mounted) return;
        setPlans(result.plans);
        setActivePlanCount(result.activePlanCount);
        setMaxActivePlans(result.maxActivePlans);
        setServiceError('');
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setServiceError(error instanceof Error ? error.message : 'Membership plans could not be loaded.');
        // Keep local count as fallback
        setActivePlanCount(localActiveCount);
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [setPlans, localActiveCount]);

  const syncPlanMutation = async (method: 'POST' | 'PATCH', body: unknown): Promise<boolean> => {
    setSaving(true);
    setServiceError('');
    try {
      const response = await fetch('/api/gym-plans', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await readPlanResponse(response);
      setPlans(result.plans);
      setActivePlanCount(result.activePlanCount);
      setMaxActivePlans(result.maxActivePlans);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Membership plan could not be saved.';
      setServiceError(message);
      toast(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (plan: Plan) => {
    if (!await syncPlanMutation('PATCH', { action: 'deactivate', name: plan.name })) return;
    toast(`${plan.name} deactivated`);
  };

  const activate = async (plan: Plan) => {
    if (!await syncPlanMutation('PATCH', { action: 'activate', name: plan.name })) return;
    toast(`${plan.name} reactivated`);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingPlan({ mode: 'create' });
  };

  const openEdit = (plan: Plan) => {
    setForm({
      name: plan.name,
      price: String(plan.price),
      cycle: plan.period === 'yr' ? 'Annual' : plan.period === 'qtr' ? 'Quarterly' : 'Monthly',
      perks: plan.perks.join(', '),
    });
    setEditingPlan({ mode: 'edit', plan });
  };

  const closeModal = () => setEditingPlan(null);

  const submitPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const price = Number(form.price);
    if (!form.name.trim() || !form.price || !Number.isFinite(price) || price < 0) {
      toast('Enter a plan name and a valid non-negative price.');
      return;
    }
    const perks = form.perks.split(',').map((perk) => perk.trim()).filter(Boolean);
    const plan: Plan = {
      ...(editingPlan?.mode === 'edit' ? editingPlan.plan : {
        members: 0,
        featured: false,
        status: 'Active' as const,
        category: 'Standard',
        description: '',
        restrictions: [],
        sessionLimit: 0,
        facilities: [],
        includedBenefits: [],
        excludedBenefits: [],
      }),
      name: form.name.trim(),
      price,
      period: form.cycle === 'Annual' ? 'yr' : form.cycle === 'Quarterly' ? 'qtr' : 'mo',
      perks,
      includedBenefits: editingPlan?.mode === 'edit'
        ? editingPlan.plan.includedBenefits
        : perks,
    };

    const succeeded = editingPlan?.mode === 'edit'
      ? await syncPlanMutation('PATCH', { action: 'update', originalName: editingPlan.plan.name, plan })
      : await syncPlanMutation('POST', { plan });
    if (!succeeded) return;
    toast(editingPlan?.mode === 'edit' ? `Plan updated — ${plan.name}` : `Plan created — ${plan.name}`);
    closeModal();
  };

  const atLimit = activePlanCount >= maxActivePlans;

  return (
    <>
      <div className="admin-plan-limit" role="status">
        <div>
          <strong>Active plan limit</strong>
          <span style={{ marginLeft: 12 }}>{loading ? 'Loading limit…' : `${activePlanCount} of ${maxActivePlans} active plans`}</span>
        </div>
        <div className="admin-plan-limit-track" aria-hidden="true">
          <span style={{ width: `${Math.min(100, maxActivePlans > 0 ? activePlanCount / maxActivePlans * 100 : 0)}%` }} />
        </div>
      </div>
      {serviceError && <p className="admin-plan-error" role="alert">{serviceError}</p>}
      <div className="member-plan-grid" style={{ marginBottom: 22 }}>
        {plans.map((plan) => {
          const isFeatured = plan.featured;
          const isInactive = plan.status === 'Inactive';
          return (
            <div className={`plan-card${isFeatured ? ' featured' : ''}`} key={plan.name} style={isInactive ? { opacity: .55 } : undefined}>
              {isFeatured && <span className="ribbon">Most Popular</span>}
              <h3 style={{ fontSize: 22 }}>{plan.name}</h3>
              <div className="price">{peso(plan.price)}<span>/{plan.period}</span></div>
              <ul>{plan.perks.map((perk, index) => <li key={index}>✓ {perk}</li>)}</ul>
              {plan.terms && <p className="plan-card-terms"><span className="plan-card-label">Terms</span>{plan.terms}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className={`btn btn-sm ${isFeatured ? 'btn-signal' : 'btn-outline'}`} type="button" onClick={() => openEdit(plan)} disabled={loading || saving}>Edit Plan</button>
                {isInactive
                  ? <button className="btn btn-ghost btn-sm" type="button" onClick={() => activate(plan)} disabled={loading || saving || atLimit}>Reactivate</button>
                  : <button className="btn btn-ghost btn-sm" type="button" onClick={() => deactivate(plan)} disabled={loading || saving}>Deactivate</button>
                }
              </div>
            </div>
          );
        })}
      </div>
      <TabbedCard
        title="Plan Management"
        right={<button className="btn btn-signal btn-sm" type="button" onClick={openCreate} disabled={loading || saving || atLimit}>+ Create Plan</button>}
      >
        <div className="admin-plan-help">
          <span>Plan changes are saved to the database and enforced by the server.</span>
          {atLimit && <strong>The active plan limit is reached. Deactivate a plan before creating or reactivating one.</strong>}
          {loading && <span>Loading the current plan catalog…</span>}
        </div>
      </TabbedCard>

      {editingPlan && (
        <Modal title={editingPlan.mode === 'edit' ? `Edit Plan — ${editingPlan.plan.name}` : 'Create Plan'} onClose={closeModal} wide>
          <form onSubmit={submitPlan} className="admin-plan-form">
            <div className="grid grid-3">
              <Field label="Plan Name"><TextInput required placeholder="e.g. Student" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} /></Field>
              <Field label="Price (₱ / period)"><TextInput type="number" min="0" required placeholder="1999" value={form.price} onChange={(value) => setForm((current) => ({ ...current, price: value }))} /></Field>
              <Field label="Billing Cycle">
                <Select value={form.cycle} onChange={(value) => setForm((current) => ({ ...current, cycle: value }))}>
                  <option>Monthly</option><option>Quarterly</option><option>Annual</option>
                </Select>
              </Field>
            </div>
            <Field label="Perks (comma separated)"><TextInput placeholder="Gym floor access, Locker access…" value={form.perks} onChange={(value) => setForm((current) => ({ ...current, perks: value }))} /></Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-signal" type="submit" disabled={saving}>{saving ? 'Saving…' : editingPlan.mode === 'edit' ? 'Save Changes' : 'Create Plan'}</button>
              <button className="btn btn-outline" type="button" onClick={closeModal} disabled={saving}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default AdminPlans;
