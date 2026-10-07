"use client";

import Link from "next/link";
import { useState } from "react";

import type { PackingSlipModel } from "@/lib/packing-slip";

// Plain CSS (em-based, black on white) so the slip prints the same in light
// and dark mode and scales with the paper's base font size. The control bar is
// screen-only. The amount box keeps its dark fill when printing
// (print-color-adjust) and has a thick black border either way.
const STYLES = `
.ps-root { color-scheme: light; min-height: 100vh; background: #e5e7eb; color: #000; padding: 0 0 24px; }
.ps-controls { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 10px 16px; background: #fff; border-bottom: 1px solid #d1d5db; font-size: 14px; }
.ps-controls-group { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.ps-print-btn { min-height: 40px; padding: 0 18px; border-radius: 6px; background: #111827; color: #fff; font-weight: 600; border: 0; cursor: pointer; }
.ps-print-btn:focus-visible, .ps-toggle input:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.ps-toggle { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; cursor: pointer; user-select: none; }
.ps-toggle input { width: 18px; height: 18px; accent-color: #111827; }
.ps-hint { color: #4b5563; font-size: 12px; }
.ps-sheet { box-sizing: border-box; width: 100%; margin: 16px auto 0; background: #fff; color: #000; padding: 10mm; box-shadow: 0 1px 4px rgba(0,0,0,.15); line-height: 1.35; }
.ps-sheet[data-paper="A5"] { max-width: 148mm; font-size: 10pt; }
.ps-sheet[data-paper="A4"] { max-width: 210mm; font-size: 12pt; }
.ps-sheet * { box-sizing: border-box; }
.ps-wrap { overflow-wrap: anywhere; word-break: break-word; }
.ps-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1em; padding-bottom: .7em; border-bottom: 2px solid #000; }
.ps-brand { display: flex; align-items: center; gap: .6em; min-width: 0; }
.ps-logo { display: block; max-height: 3.2em; max-width: 7em; object-fit: contain; }
.ps-store { font-size: 1.3em; font-weight: 700; }
.ps-meta { flex-shrink: 0; text-align: right; }
.ps-title { font-size: .8em; font-weight: 700; letter-spacing: .14em; }
.ps-order { font-size: 1.6em; font-weight: 800; line-height: 1.15; }
.ps-date { font-size: .9em; }
.ps-banner { margin-top: .8em; padding: .25em .5em; border: 3px solid #000; text-align: center; font-size: 1.8em; font-weight: 900; letter-spacing: .12em; break-inside: avoid; }
.ps-note { margin-top: .8em; white-space: pre-wrap; }
.ps-addresses { display: grid; grid-template-columns: 1fr 1fr; gap: .8em; margin-top: .8em; }
.ps-box { min-width: 0; padding: .55em .7em; border: 1.5px solid #000; break-inside: avoid; }
.ps-box.ps-ship { border-width: 2.5px; font-size: 1.08em; }
.ps-label { font-size: .72em; font-weight: 700; letter-spacing: .12em; margin-bottom: .2em; }
.ps-name { font-weight: 700; font-size: 1.08em; }
.ps-items { width: 100%; margin-top: 1em; border-collapse: collapse; }
.ps-items thead { display: table-header-group; }
.ps-items th { padding: .35em .3em; border-bottom: 1.5px solid #000; text-align: left; font-size: .75em; letter-spacing: .08em; }
.ps-items td { padding: .45em .3em; border-bottom: 1px solid #9ca3af; vertical-align: top; }
.ps-items tr { break-inside: avoid; page-break-inside: avoid; }
.ps-items .ps-num { text-align: right; white-space: nowrap; width: 1%; }
.ps-item-name { font-weight: 600; }
.ps-options { font-size: .85em; color: #333; }
.ps-totals { width: 55%; min-width: 12em; margin: .6em 0 0 auto; break-inside: avoid; }
.ps-totals div { display: flex; justify-content: space-between; gap: 1em; padding: .15em .3em; }
.ps-totals .ps-grand { border-top: 1.5px solid #000; font-weight: 800; }
.ps-collect { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .3em 1em; margin-top: 1em; padding: .55em .8em; background: #000; color: #fff; border: 3px solid #000; font-weight: 800; break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ps-collect-label { font-size: 1.05em; letter-spacing: .04em; }
.ps-collect-amount { font-size: 1.9em; line-height: 1.1; white-space: nowrap; }
.ps-notes { margin-top: .8em; padding: .5em .7em; border: 1px dashed #000; white-space: pre-wrap; break-inside: avoid; }
.ps-footer { margin-top: 1em; padding-top: .6em; border-top: 1px solid #000; text-align: center; white-space: pre-wrap; break-inside: avoid; }
.ps-message { max-width: 32rem; margin: 15vh auto 0; padding: 24px 16px; text-align: center; font-size: 16px; }
.ps-message a { display: inline-block; margin-top: 12px; text-decoration: underline; font-weight: 600; }
@media screen and (max-width: 480px) {
  .ps-sheet { margin-top: 0; padding: 16px; box-shadow: none; }
  .ps-addresses { grid-template-columns: 1fr; }
}
@media print {
  html, body, .ps-root { background: #fff !important; }
  .ps-root { min-height: 0; padding: 0; }
  .ps-controls { display: none !important; }
  .ps-sheet { max-width: none !important; margin: 0; padding: 0; box-shadow: none; }
}
`;

export function SlipMessage({
    title,
    link,
}: {
    title: string;
    link?: { href: string; label: string };
}) {
    return (
        <div className="ps-root">
            <style>{STYLES}</style>
            <div className="ps-message" role="status">
                <p>{title}</p>
                {link && <Link href={link.href}>{link.label}</Link>}
            </div>
        </div>
    );
}

export function SlipView({
    withoutPrices,
    withPrices,
}: {
    withoutPrices: PackingSlipModel;
    withPrices: PackingSlipModel;
}) {
    const [showPrices, setShowPrices] = useState(false);
    const slip = showPrices ? withPrices : withoutPrices;

    return (
        <div className="ps-root">
            <style>{STYLES}</style>
            <style>{`@page { size: ${slip.paperSize}; margin: 10mm; }`}</style>

            <div className="ps-controls">
                <div className="ps-controls-group">
                    <button type="button" className="ps-print-btn" onClick={() => window.print()}>
                        Print
                    </button>
                    <label className="ps-toggle">
                        <input
                            type="checkbox"
                            checked={showPrices}
                            onChange={(event) => setShowPrices(event.target.checked)}
                        />
                        Show prices
                    </label>
                </div>
                <span className="ps-hint">
                    Paper: {slip.paperSize} (change it in Settings). Choose {slip.paperSize} in the print dialog.
                </span>
            </div>

            <article className="ps-sheet" data-paper={slip.paperSize} aria-label="Packing slip">
                <header className="ps-top">
                    <div className="ps-brand">
                        {slip.logoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={slip.logoUrl} alt="" className="ps-logo" />
                        )}
                        <div className="ps-store ps-wrap">{slip.storeName}</div>
                    </div>
                    <div className="ps-meta">
                        <div className="ps-title">PACKING SLIP</div>
                        <div className="ps-order ps-wrap">#{slip.orderNumber}</div>
                        <div className="ps-date">{slip.orderDate}</div>
                    </div>
                </header>

                {slip.banner && <div className="ps-banner">{slip.banner}</div>}

                {slip.headerText && <div className="ps-note ps-wrap">{slip.headerText}</div>}

                <section className="ps-addresses">
                    <div className="ps-box ps-wrap">
                        <div className="ps-label">FROM</div>
                        <div className="ps-name">{slip.from.name}</div>
                        <div>{slip.from.phone}</div>
                        <div>{slip.from.address}</div>
                        <div>{slip.from.city}</div>
                    </div>
                    <div className="ps-box ps-ship ps-wrap">
                        <div className="ps-label">SHIP TO</div>
                        <div className="ps-name">{slip.shipTo.name}</div>
                        <div>{slip.shipTo.phone}</div>
                        {slip.shipTo.lines.map((line, index) => (
                            <div key={index}>{line}</div>
                        ))}
                    </div>
                </section>

                <table className="ps-items">
                    <thead>
                        <tr>
                            <th scope="col">ITEM</th>
                            <th scope="col" className="ps-num">QTY</th>
                            {slip.showPrices && (
                                <>
                                    <th scope="col" className="ps-num">PRICE</th>
                                    <th scope="col" className="ps-num">TOTAL</th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {slip.items.map((item, index) => (
                            <tr key={index}>
                                <td className="ps-wrap">
                                    <div className="ps-item-name">{item.name}</div>
                                    {item.options && <div className="ps-options">{item.options}</div>}
                                </td>
                                <td className="ps-num">{item.quantity}</td>
                                {slip.showPrices && (
                                    <>
                                        <td className="ps-num">{item.unitPrice}</td>
                                        <td className="ps-num">{item.lineTotal}</td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {slip.totals && (
                    <div className="ps-totals">
                        <div>
                            <span>Subtotal</span>
                            <span>{slip.totals.subtotal}</span>
                        </div>
                        {slip.totals.delivery !== null && (
                            <div>
                                <span>Delivery</span>
                                <span>{slip.totals.delivery}</span>
                            </div>
                        )}
                        <div className="ps-grand">
                            <span>Total</span>
                            <span>{slip.totals.total}</span>
                        </div>
                    </div>
                )}

                <div className="ps-collect">
                    {slip.amountToCollect.kind === "cod" ? (
                        <>
                            <span className="ps-collect-label">{slip.amountToCollect.label}:</span>
                            <span className="ps-collect-amount">{slip.amountToCollect.amount}</span>
                        </>
                    ) : (
                        <span className="ps-collect-label">{slip.amountToCollect.label}</span>
                    )}
                </div>

                {slip.notes && (
                    <div className="ps-notes ps-wrap">
                        <div className="ps-label">CUSTOMER NOTES</div>
                        {slip.notes}
                    </div>
                )}

                {slip.footerText && <footer className="ps-footer ps-wrap">{slip.footerText}</footer>}
            </article>
        </div>
    );
}
