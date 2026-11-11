"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addCompanyAction, requestSyncAction, AddCompanySchema } from "./actions";
import { Loader2, Plus, RefreshCw, Building2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export interface CompanyRowData {
  id: string;
  name: string;
  ats: "greenhouse" | "lever" | "ashby";
  board_token: string;
  active: boolean;
  last_synced_at: string | null;
  sync_requested_at: string | null;
  totalJobs: number;
  openJobs: number;
}

interface CompanyListClientProps {
  companies: CompanyRowData[];
}

export function CompanyListClient({ companies }: CompanyListClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [ats, setAts] = useState<"greenhouse" | "lever" | "ashby">("greenhouse");
  const [token, setToken] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = AddCompanySchema.safeParse({ name, ats, token });
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || "Invalid input");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await addCompanyAction(validation.data);
      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
      } else {
        toast.success(`Company ${name} added and queued for sync!`);
        setName("");
        setToken("");
        setAts("greenhouse");
        setDialogOpen(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add company";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncNow = async (companyId: string, companyName: string) => {
    setSyncingId(companyId);
    try {
      const res = await requestSyncAction(companyId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Sync requested for ${companyName}! The worker will pick it up.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync request failed");
    } finally {
      setSyncingId(null);
    }
  };

  const atsColor = (atsType: string) => {
    switch (atsType) {
      case "greenhouse":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "lever":
        return "bg-violet-500/10 text-violet-600 border-violet-500/20";
      case "ashby":
        return "bg-sky-500/10 text-sky-600 border-sky-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Tracked Companies & Boards
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage company job boards from Greenhouse, Lever, and Ashby.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9 text-xs">
              <Plus className="h-4 w-4 mr-1.5" /> Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Company Board</DialogTitle>
              <DialogDescription>
                Configure a new company board for automated job ingestion.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddCompany} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="company-name" className="text-xs">Company Name</Label>
                <Input
                  id="company-name"
                  placeholder="e.g. Figma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company-ats" className="text-xs">ATS Provider</Label>
                <Select
                  value={ats}
                  onValueChange={(val) => setAts(val as "greenhouse" | "lever" | "ashby")}
                >
                  <SelectTrigger id="company-ats" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="greenhouse" className="text-xs">Greenhouse</SelectItem>
                    <SelectItem value="lever" className="text-xs">Lever</SelectItem>
                    <SelectItem value="ashby" className="text-xs">Ashby</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="company-token" className="text-xs">
                  Board Token / Slug (alphanumeric, dashes, underscores)
                </Label>
                <Input
                  id="company-token"
                  placeholder="e.g. figma"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {formError && (
                <p className="text-xs text-destructive">{formError}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="text-xs">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Company"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configured Boards ({companies.length})</CardTitle>
          <CardDescription className="text-xs">
            The worker syncs these boards every 6 hours or upon clicking &quot;Sync Now&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              No companies added yet. Click &quot;Add Company&quot; or run the seed script.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs">ATS</TableHead>
                    <TableHead className="text-xs">Token / Slug</TableHead>
                    <TableHead className="text-xs">Job Count</TableHead>
                    <TableHead className="text-xs">Last Sync</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((c) => {
                    const isPending =
                      c.sync_requested_at &&
                      (!c.last_synced_at ||
                        new Date(c.sync_requested_at).getTime() >
                          new Date(c.last_synced_at).getTime());

                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-xs text-foreground">
                          {c.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] font-semibold uppercase ${atsColor(c.ats)}`}>
                            {c.ats}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {c.board_token}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-semibold text-foreground">{c.openJobs}</span>
                          <span className="text-muted-foreground"> open / {c.totalJobs} total</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.last_synced_at ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              {new Date(c.last_synced_at).toLocaleString([], {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Never</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={syncingId === c.id || !!isPending}
                            onClick={() => handleSyncNow(c.id, c.name)}
                            className="h-7 text-xs"
                          >
                            {syncingId === c.id ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Requesting...
                              </>
                            ) : isPending ? (
                              <>
                                <Clock className="h-3 w-3 mr-1 text-amber-500" /> Pending...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1" /> Sync Now
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
