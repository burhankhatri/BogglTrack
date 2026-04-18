"use client";

import { useEffect, useRef, useState } from "react";
import { User, Clock, CreditCard, Palette, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GitHubConnectCard } from "@/components/settings/github-connect-card";
import { CURRENCIES } from "@/lib/constants";
import { useAppStore } from "@/stores/app-store";

interface UserSettings {
  name: string;
  email: string | null;
  defaultHourlyRate: number;
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  timeFormat: string;
  weekStartDay: string;
  theme: string;
}

type SaveStatus = "idle" | "saving" | "saved";

export default function SettingsPage() {
  const storeSettings = useAppStore((s) => s.settings.data);
  const fetchStoreSettings = useAppStore((s) => s.fetchSettings);
  const [, setSettings] = useState<UserSettings | null>(storeSettings);
  const [loading, setLoading] = useState(!storeSettings);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const { setTheme } = useTheme();

  const [name, setName] = useState(storeSettings?.name ?? "");
  const [email, setEmail] = useState(storeSettings?.email ?? "");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(String(storeSettings?.defaultHourlyRate ?? ""));
  const [currency, setCurrency] = useState(storeSettings?.currency ?? "USD");
  const [dateFormat, setDateFormat] = useState(storeSettings?.dateFormat ?? "MM/dd/yyyy");
  const [timeFormat, setTimeFormat] = useState(storeSettings?.timeFormat ?? "24h");
  const [weekStartDay, setWeekStartDay] = useState(storeSettings?.weekStartDay ?? "monday");
  const [themeValue, setThemeValue] = useState(storeSettings?.theme ?? "system");

  // One-shot hydration from the server. `hydratedRef` prevents the auto-save
  // effect from firing on the initial form population.
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchStoreSettings().then((data) => {
      setSettings(data);
      setName(data.name);
      setEmail(data.email || "");
      setDefaultHourlyRate(String(data.defaultHourlyRate));
      setCurrency(data.currency);
      setDateFormat(data.dateFormat);
      setTimeFormat(data.timeFormat);
      setWeekStartDay(data.weekStartDay);
      setThemeValue(data.theme);
      setLoading(false);
      hydratedRef.current = true;
    }).catch(() => {
      toast.error("Failed to load settings");
      setLoading(false);
    });
  }, [fetchStoreSettings]);

  // Debounced auto-save — PATCHes 600ms after the last change.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      const currencyObj = CURRENCIES.find((c) => c.code === currency);
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim() || null,
            defaultHourlyRate: parseFloat(defaultHourlyRate) || 0,
            currency,
            currencySymbol: currencyObj?.symbol || "$",
            dateFormat,
            timeFormat,
            weekStartDay,
            theme: themeValue,
          }),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        setSettings(updated);
        useAppStore.getState().invalidate("settings");
        setSaveStatus("saved");
        savedFlashTimerRef.current = setTimeout(() => setSaveStatus("idle"), 1500);
      } catch {
        setSaveStatus("idle");
        toast.error("Couldn't save — check your connection");
      }
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [name, email, defaultHourlyRate, currency, dateFormat, timeFormat, weekStartDay, themeValue]);

  function handleCurrencyChange(code: string | null) {
    if (code) setCurrency(code);
  }

  function handleThemeChange(value: string | null) {
    if (value) {
      setThemeValue(value);
      setTheme(value);
    }
  }

  const currencySymbol = CURRENCIES.find((c) => c.code === currency)?.symbol || "$";

  if (loading) {
    return (
      <div className="space-y-8 max-w-[800px] mx-auto py-8 px-4 lg:px-0">
        <div>
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-[var(--radius-xl)]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto py-8 px-4 lg:px-0">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[28px] font-serif font-semibold text-[var(--text-forest)] tracking-tight mb-1">
            Settings
          </h1>
          <p className="text-[15px] text-[var(--text-olive)]">
            Manage your account preferences and defaults.
          </p>
        </div>
        {/* Auto-save status — no button, no sticky. Minimal and out of the way. */}
        <div
          aria-live="polite"
          className="flex items-center gap-1.5 text-[12px] text-[var(--text-olive)]/80 whitespace-nowrap"
        >
          {saveStatus === "saving" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving…</span>
            </>
          ) : saveStatus === "saved" ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-[var(--accent-olive-hover)]" />
              <span>Saved</span>
            </>
          ) : (
            <span>Changes save automatically</span>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {/* Profile */}
        <Card className="overflow-hidden border-none shadow-[var(--shadow-card)] ring-1 ring-[var(--border-subtle)]">
          <CardHeader className="bg-[var(--bg-muted)]/30 border-b border-[var(--border-subtle)] pb-4">
            <CardTitle className="flex items-center gap-2 text-xl font-serif text-[var(--text-forest)]">
              <User className="size-5 text-[var(--text-olive)]" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 pt-6">
            <div className="space-y-2">
              <Label htmlFor="settings-name" className="text-[14px]">Name</Label>
              <Input
                id="settings-name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email" className="text-[14px]">Email</Label>
              <Input
                id="settings-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11"
              />
            </div>
          </CardContent>
        </Card>

        {/* Rates */}
        <Card className="overflow-hidden border-none shadow-[var(--shadow-card)] ring-1 ring-[var(--border-subtle)]">
          <CardHeader className="bg-[var(--bg-muted)]/30 border-b border-[var(--border-subtle)] pb-4">
            <CardTitle className="flex items-center gap-2 text-xl font-serif text-[var(--text-forest)]">
              <CreditCard className="size-5 text-[var(--text-olive)]" />
              Rates & Currency
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2 pt-6">
            <div className="space-y-2">
              <Label htmlFor="settings-rate" className="text-[14px]">Default Hourly Rate</Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-[var(--text-olive)]">
                  {currencySymbol}
                </span>
                <Input
                  id="settings-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={defaultHourlyRate}
                  onChange={(e) => setDefaultHourlyRate(e.target.value)}
                  className="pl-8 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[14px]">Currency</Label>
              <Select value={currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger className="w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card className="overflow-hidden border-none shadow-[var(--shadow-card)] ring-1 ring-[var(--border-subtle)]">
          <CardHeader className="bg-[var(--bg-muted)]/30 border-b border-[var(--border-subtle)] pb-4">
            <CardTitle className="flex items-center gap-2 text-xl font-serif text-[var(--text-forest)]">
              <Clock className="size-5 text-[var(--text-olive)]" />
              Date & Time
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-3 pt-6">
            <div className="space-y-2">
              <Label className="text-[14px]">Date Format</Label>
              <Select value={dateFormat} onValueChange={(v) => v && setDateFormat(v)}>
                <SelectTrigger className="w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/dd/yyyy">MM/dd/yyyy</SelectItem>
                  <SelectItem value="dd/MM/yyyy">dd/MM/yyyy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[14px]">Time Format</Label>
              <Select value={timeFormat} onValueChange={(v) => v && setTimeFormat(v)}>
                <SelectTrigger className="w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[14px]">Week Starts On</Label>
              <Select value={weekStartDay} onValueChange={(v) => v && setWeekStartDay(v)}>
                <SelectTrigger className="w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sunday">Sunday</SelectItem>
                  <SelectItem value="monday">Monday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <GitHubConnectCard />

        {/* Appearance */}
        <Card className="overflow-hidden border-none shadow-[var(--shadow-card)] ring-1 ring-[var(--border-subtle)]">
          <CardHeader className="bg-[var(--bg-muted)]/30 border-b border-[var(--border-subtle)] pb-4">
            <CardTitle className="flex items-center gap-2 text-xl font-serif text-[var(--text-forest)]">
              <Palette className="size-5 text-[var(--text-olive)]" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:max-w-xs pt-6">
            <div className="space-y-2">
              <Label className="text-[14px]">Theme</Label>
              <Select value={themeValue} onValueChange={handleThemeChange}>
                <SelectTrigger className="w-full h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light (Sage & Cream)</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System Default</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
