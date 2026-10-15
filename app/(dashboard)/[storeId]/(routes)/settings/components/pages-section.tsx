"use client";

import axios from "axios";
import { ChevronDown, ChevronUp, Plus, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
    MAX_FAQ_ANSWER_LENGTH,
    MAX_FAQ_ITEMS,
    MAX_FAQ_QUESTION_LENGTH,
    STORE_PAGE_LABELS,
    STORE_PAGE_SLUGS,
    TEXT_PAGE_KINDS,
    TEXT_PAGE_LIMITS,
    codePointLength,
    formatCount,
    normalizeFaqQuestion,
    normalizePageText,
    parseStorePagePatch,
    type FaqItem,
    type StorePagesSettings,
    type TextPageKind,
} from "@/lib/store-pages";

interface PagesSectionProps {
    storeId: string;
    /** The saved pages, in the merchant API shape. */
    initialSettings: StorePagesSettings;
}

const TEXT_PAGE_DESCRIPTIONS: Record<TextPageKind, string> = {
    ABOUT: "Tell shoppers who you are and what you sell.",
    CONTACT: "How shoppers can reach you, for example your phone number, hours or address.",
    RETURNS: "Explain how returns and exchanges work at your shop.",
};

const SAVED_TOASTS: Record<TextPageKind | "FAQ", string> = {
    ABOUT: "About page saved.",
    CONTACT: "Contact page saved.",
    RETURNS: "Returns & exchanges page saved.",
    FAQ: "FAQ saved.",
};

const TEXTAREA_CLASS =
    "flex min-h-[80px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

// The API's 400 text, else a generic message.
const saveErrorMessage = (err: any) => {
    const text = err?.response?.data;
    return err?.response?.status === 400 && typeof text === "string" && text ? text : "Something went wrong.";
};

// "1,234 / 5,000", red when over the limit.
function Counter({ id, length, max }: { id: string; length: number; max: number }) {
    return (
        <span
            id={id}
            className={`shrink-0 text-sm tabular-nums ${length > max ? "font-medium text-destructive" : "text-muted-foreground"}`}
        >
            {formatCount(length)} / {formatCount(max)}
        </span>
    );
}

function PageCard({
    slug,
    title,
    description,
    children,
}: {
    slug: string;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section aria-labelledby={`page-${slug}-heading`} className="min-w-0 space-y-4 rounded-lg border p-4 sm:p-6">
            <div className="min-w-0 space-y-1">
                <h3 id={`page-${slug}-heading`} className="text-lg font-semibold">
                    {title}
                </h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
        </section>
    );
}

export function PagesSection({ storeId, initialSettings }: PagesSectionProps) {
    const page = (kind: TextPageKind) => initialSettings.pages.find((p) => p.kind === kind);
    const faq = initialSettings.pages.find((p) => p.kind === "FAQ");

    return (
        <div className="min-w-0 space-y-4">
            <Heading
                title="Store pages"
                description="Simple pages for your shop. Plain text only; line breaks are kept. A page shows only while it is turned on and has text."
            />
            <Separator />
            <div className="min-w-0 space-y-6">
                {TEXT_PAGE_KINDS.map((kind) => (
                    <TextPageForm
                        key={kind}
                        storeId={storeId}
                        kind={kind}
                        initialEnabled={page(kind)?.enabled ?? false}
                        initialBody={page(kind)?.body ?? null}
                    />
                ))}
                <FaqForm
                    storeId={storeId}
                    initialEnabled={faq?.enabled ?? false}
                    initialItems={initialSettings.faqItems}
                />
            </div>
        </div>
    );
}

function TextPageForm({
    storeId,
    kind,
    initialEnabled,
    initialBody,
}: {
    storeId: string;
    kind: TextPageKind;
    initialEnabled: boolean;
    initialBody: string | null;
}) {
    const router = useRouter();
    const [enabled, setEnabled] = useState(initialEnabled);
    const [text, setText] = useState(initialBody ?? "");
    const [dirty, setDirty] = useState(false);
    const [loading, setLoading] = useState(false);

    // Same rules as the server (lib/store-pages.ts), so the message matches its 400.
    const body = { kind, enabled, body: text };
    const parsed = parseStorePagePatch(body);
    const error = "error" in parsed ? parsed.error : null;

    const slug = STORE_PAGE_SLUGS[kind];
    const label = STORE_PAGE_LABELS[kind];
    const max = TEXT_PAGE_LIMITS[kind];
    const length = codePointLength(normalizePageText(text));

    const save = async () => {
        if (error) return;

        try {
            setLoading(true);
            const { data } = await axios.patch<StorePagesSettings>(`/api/stores/${storeId}/pages`, body);
            const saved = data.pages.find((p) => p.kind === kind);
            setEnabled(saved?.enabled ?? false);
            setText(saved?.body ?? "");
            setDirty(false);
            router.refresh();
            toast.success(SAVED_TOASTS[kind]);
        } catch (err: any) {
            toast.error(saveErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageCard slug={slug} title={label} description={TEXT_PAGE_DESCRIPTIONS[kind]}>
            <form
                noValidate
                className="min-w-0 space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    save();
                }}
            >
                <div className="flex min-h-[44px] items-center gap-3">
                    <Switch
                        id={`page-${slug}-enabled`}
                        checked={enabled}
                        disabled={loading}
                        onCheckedChange={(next) => {
                            setEnabled(next);
                            setDirty(true);
                        }}
                    />
                    <Label htmlFor={`page-${slug}-enabled`} className="cursor-pointer leading-snug">
                        Show this page
                    </Label>
                </div>

                <div className="min-w-0 space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                        <Label htmlFor={`page-${slug}-text`}>{label} text</Label>
                        <Counter id={`page-${slug}-count`} length={length} max={max} />
                    </div>
                    <textarea
                        id={`page-${slug}-text`}
                        dir="auto"
                        rows={kind === "CONTACT" ? 6 : 10}
                        className={TEXTAREA_CLASS}
                        disabled={loading}
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            setDirty(true);
                        }}
                        aria-invalid={dirty && Boolean(error)}
                        aria-describedby={
                            kind === "CONTACT" ? `page-${slug}-count page-${slug}-hint` : `page-${slug}-count`
                        }
                    />
                    {kind === "CONTACT" && (
                        <p id={`page-${slug}-hint`} className="text-sm text-muted-foreground">
                            Your WhatsApp button and social links are shown under this text.
                        </p>
                    )}
                    {dirty && error ? (
                        <p role="alert" className="break-words text-sm font-medium text-destructive">
                            {error}
                        </p>
                    ) : null}
                </div>

                <Button type="submit" disabled={loading || Boolean(error)} className="h-11 w-full sm:w-auto">
                    Save
                </Button>
            </form>
        </PageCard>
    );
}

type FormItem = FaqItem & { key: string };

let nextKey = 0;
const newKey = () => `new-${++nextKey}`;

// Saved items get index keys, so the server and client renders match.
const toFormItems = (items: FaqItem[]): FormItem[] =>
    items.map((item, index) => ({ key: `saved-${index}`, question: item.question, answer: item.answer }));

function FaqForm({
    storeId,
    initialEnabled,
    initialItems,
}: {
    storeId: string;
    initialEnabled: boolean;
    initialItems: FaqItem[];
}) {
    const router = useRouter();
    const [enabled, setEnabled] = useState(initialEnabled);
    const [items, setItems] = useState<FormItem[]>(() => toFormItems(initialItems));
    const [dirty, setDirty] = useState(false);
    const [loading, setLoading] = useState(false);

    // Same rules as the server (lib/store-pages.ts), so the message matches its 400.
    const body = {
        kind: "FAQ" as const,
        enabled,
        items: items.map(({ question, answer }) => ({ question, answer })),
    };
    const parsed = parseStorePagePatch(body);
    const error = "error" in parsed ? parsed.error : null;
    const full = items.length >= MAX_FAQ_ITEMS;

    const change = (updater: (prev: FormItem[]) => FormItem[]) => {
        setItems(updater);
        setDirty(true);
    };

    const updateItem = (key: string, field: keyof FaqItem, value: string) =>
        change((prev) => prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)));

    const moveItem = (index: number, delta: -1 | 1) =>
        change((prev) => {
            const next = [...prev];
            const target = index + delta;
            if (target < 0 || target >= next.length) return prev;
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });

    const save = async () => {
        if (error) return;

        try {
            setLoading(true);
            const { data } = await axios.patch<StorePagesSettings>(`/api/stores/${storeId}/pages`, body);
            setEnabled(data.pages.find((p) => p.kind === "FAQ")?.enabled ?? false);
            setItems(toFormItems(data.faqItems));
            setDirty(false);
            router.refresh();
            toast.success(SAVED_TOASTS.FAQ);
        } catch (err: any) {
            toast.error(saveErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageCard slug="faq" title={STORE_PAGE_LABELS.FAQ} description="Questions shoppers often ask, with your answers.">
            <form
                noValidate
                className="min-w-0 space-y-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    save();
                }}
            >
                <div className="flex min-h-[44px] items-center gap-3">
                    <Switch
                        id="page-faq-enabled"
                        checked={enabled}
                        disabled={loading}
                        onCheckedChange={(next) => {
                            setEnabled(next);
                            setDirty(true);
                        }}
                    />
                    <Label htmlFor="page-faq-enabled" className="cursor-pointer leading-snug">
                        Show this page
                    </Label>
                </div>

                <div className="min-w-0 space-y-3">
                    <h4 className="text-sm font-medium">
                        Questions ({items.length} of {MAX_FAQ_ITEMS})
                    </h4>

                    {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No questions yet.</p>
                    ) : (
                        <ol className="min-w-0 space-y-3">
                            {items.map((item, index) => (
                                <FaqItemCard
                                    key={item.key}
                                    item={item}
                                    index={index}
                                    count={items.length}
                                    disabled={loading}
                                    onChange={(field, value) => updateItem(item.key, field, value)}
                                    onMove={(delta) => moveItem(index, delta)}
                                    onRemove={() => change((prev) => prev.filter((i) => i.key !== item.key))}
                                />
                            ))}
                        </ol>
                    )}

                    <div className="min-w-0 space-y-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading || full}
                            onClick={() => change((prev) => [...prev, { key: newKey(), question: "", answer: "" }])}
                            className="min-h-[44px] w-full justify-start gap-2 sm:w-auto"
                        >
                            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                            Add question
                        </Button>
                        {full && (
                            <p className="text-sm text-muted-foreground">
                                You can add up to {MAX_FAQ_ITEMS} questions.
                            </p>
                        )}
                    </div>
                </div>

                {dirty && error ? (
                    <p role="alert" className="break-words text-sm font-medium text-destructive">
                        {error}
                    </p>
                ) : null}

                <Button type="submit" disabled={loading || Boolean(error)} className="h-11 w-full sm:w-auto">
                    Save
                </Button>
            </form>
        </PageCard>
    );
}

function FaqItemCard({
    item,
    index,
    count,
    disabled,
    onChange,
    onMove,
    onRemove,
}: {
    item: FormItem;
    index: number;
    count: number;
    disabled: boolean;
    onChange: (field: keyof FaqItem, value: string) => void;
    onMove: (delta: -1 | 1) => void;
    onRemove: () => void;
}) {
    const question = normalizeFaqQuestion(item.question);
    const label = `question ${index + 1}${question ? ` (${question})` : ""}`;
    const id = (field: string) => `faq-${item.key}-${field}`;

    return (
        <li className="min-w-0 space-y-3 rounded-md border p-3 sm:p-4">
            <div className="min-w-0 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                    <Label htmlFor={id("question")}>Question {index + 1}</Label>
                    <Counter
                        id={id("question-count")}
                        length={codePointLength(question)}
                        max={MAX_FAQ_QUESTION_LENGTH}
                    />
                </div>
                <Input
                    id={id("question")}
                    dir="auto"
                    className="h-11"
                    disabled={disabled}
                    value={item.question}
                    onChange={(e) => onChange("question", e.target.value)}
                    aria-describedby={id("question-count")}
                />
            </div>

            <div className="min-w-0 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                    <Label htmlFor={id("answer")}>Answer</Label>
                    <Counter
                        id={id("answer-count")}
                        length={codePointLength(normalizePageText(item.answer))}
                        max={MAX_FAQ_ANSWER_LENGTH}
                    />
                </div>
                <textarea
                    id={id("answer")}
                    dir="auto"
                    rows={3}
                    className={TEXTAREA_CLASS}
                    disabled={disabled}
                    value={item.answer}
                    onChange={(e) => onChange("answer", e.target.value)}
                    aria-describedby={id("answer-count")}
                />
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    disabled={disabled || index === 0}
                    aria-label={`Move ${label} up`}
                    onClick={() => onMove(-1)}
                >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11"
                    disabled={disabled || index === count - 1}
                    aria-label={`Move ${label} down`}
                    onClick={() => onMove(1)}
                >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 text-destructive"
                    disabled={disabled}
                    aria-label={`Remove ${label}`}
                    onClick={onRemove}
                >
                    <Trash className="h-4 w-4" aria-hidden="true" />
                </Button>
            </div>
        </li>
    );
}
