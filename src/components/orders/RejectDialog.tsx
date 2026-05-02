import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Props {
  open: boolean;
  action: "reject" | "cancel";
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
}

const PRESETS = ["Out of stock", "Kitchen closed", "Too busy", "Duplicate order", "Other"];

export function RejectDialog({ open, action, onOpenChange, onConfirm, loading }: Props) {
  const [preset, setPreset] = useState(PRESETS[0]);
  const [extra, setExtra] = useState("");

  const submit = () => {
    const reason = preset === "Other" ? extra.trim() || "Other" : extra.trim() ? `${preset}: ${extra.trim()}` : preset;
    onConfirm(reason);
  };

  const title = action === "reject" ? "Reject order" : "Cancel order";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <RadioGroup value={preset} onValueChange={setPreset}>
              {PRESETS.map((p) => (
                <div key={p} className="flex items-center space-x-2">
                  <RadioGroupItem value={p} id={`r-${p}`} />
                  <Label htmlFor={`r-${p}`} className="font-normal">{p}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="extra">Notes (optional)</Label>
            <Textarea
              id="extra"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              maxLength={500}
              placeholder="Add any details for the customer or platform"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Back
          </Button>
          <Button variant="destructive" onClick={submit} disabled={loading}>
            {action === "reject" ? "Reject order" : "Cancel order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}