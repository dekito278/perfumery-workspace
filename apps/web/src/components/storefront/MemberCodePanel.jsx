import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { refreshTierPrices, useTierPrices } from '@/hooks/useStorefrontProducts.js';
import { redeemMemberCode } from '@/services/tierPricingService.js';
import useTranslate from '@/hooks/useTranslate.js';

const RESULT_KEYS = {
  unknown: 'member.codeUnknown',
  too_many: 'member.codeTooMany',
  signin: 'member.codeSignIn',
};

/**
 * Where a member code becomes membership (Dekito, 10 Nov 2026: one code per community, each with its own
 * percentage). Says how to become a member to someone who is not one, and takes the code from a signed-in
 * buyer. The account page shows it always; checkout passes hideForMembers.
 *
 * Renders nothing abroad — member prices are an Indonesian-order thing — and nothing before the
 * member-code migration runs, when there is no code to redeem and the field could only ever say "unknown".
 */
const MemberCodePanel = ({ className = '', hideForMembers = false }) => {
  const { currentUser } = useAuth();
  const { t, isInternational } = useTranslate();
  const { tier, codeName, memberPercent, keepsMemberPrice, codesReady } = useTierPrices();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const isMember = tier === 'member' || tier === 'reseller';
  if (isInternational || !codesReady || (hideForMembers && isMember && !message)) return null;

  const submit = async () => {
    if (!code.trim() || busy) return;
    setBusy(true);
    setMessage('');
    const { result, codeName: joined, memberPercent: percent } = await redeemMemberCode(code);
    if (result === 'ok') {
      // Same session, new tier: nothing else would reload the prices on the page and in the cart.
      await refreshTierPrices();
      setCode('');
      setMessage(t('member.codeJoined', { name: joined }));
    } else if (result === 'smaller') {
      // A real code with a smaller percentage: the member keeps the one they have, and is told which.
      setCode('');
      setMessage(t('member.codeSmaller', { name: joined, percent }));
    } else {
      setMessage(t(RESULT_KEYS[result] || 'member.codeFailed'));
    }
    setBusy(false);
  };

  let body = t('member.howBody');
  // A member from before their code pays the cheaper of the two per perfume (resolveTierPrice), so "N% on
  // every perfume" would be wrong for them wherever their old member price is lower.
  const viaCodeKey = keepsMemberPrice ? 'member.activeViaCodeKept' : 'member.activeViaCode';
  if (isMember) body = codeName && memberPercent ? t(viaCodeKey, { name: codeName, percent: memberPercent }) : t('member.activeBody');

  return (
    <section className={`rounded-none border border-ng-bone/10 bg-transparent p-4 ${className}`}>
      <p className="ng-mono m-0 text-ng-bone">{isMember ? t('member.activeTitle') : t('member.howTitle')}</p>
      <p className="mt-2 text-xs font-semibold leading-relaxed text-ng-dust">{body}</p>
      {currentUser ? (
        // Not a form element: checkout renders this INSIDE its own form, where a nested one is dropped by the
        // browser and "Pakai" — or Enter in the field — would submit the order form instead.
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              submit();
            }}
            aria-label={t('member.codeLabel')}
            placeholder={t('member.codeLabel')}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={32}
            className="h-12 min-w-0 rounded-none border px-4 text-sm font-bold uppercase tracking-[0.08em] outline-none placeholder:normal-case placeholder:tracking-normal focus:border-ng-bone/30"
          />
          <button type="button" onClick={submit} className="ng-btn ng-btn--tight" disabled={busy || !code.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
            {t('member.codeApply')}
          </button>
        </div>
      ) : null}
      {message ? <p className="mt-2 text-xs font-semibold text-ng-sand" role="status">{message}</p> : null}
    </section>
  );
};

export default MemberCodePanel;
