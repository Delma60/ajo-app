"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase/client";
import {
  createSupportTicketSchema,
  type CreateSupportTicketValues,
} from "@/lib/validators/support";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SupportTicketFormProps {
  onSubmit: (
    values: CreateSupportTicketValues & { screenshotUrl?: string },
  ) => Promise<void>;
  isLoading?: boolean;
}

export function SupportTicketForm({
  onSubmit,
  isLoading,
}: SupportTicketFormProps) {
  const [uploading, setUploading] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | undefined>(
    undefined,
  );
  const [fileName, setFileName] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setError,
  } = useForm<CreateSupportTicketValues>({
    resolver: zodResolver(createSupportTicketSchema),
    defaultValues: {
      subject: "",
      category: "general_inquiry",
      priority: "normal",
      message: "",
    },
  });

  const screenshot = watch("screenshotUrl");

  async function handleFileChange(file?: File) {
    if (!file) return;
    if (file.size > 5_000_000) {
      setError("screenshotUrl", { message: "File must be smaller than 5 MB." });
      return;
    }

    setUploading(true);
    setFileName(file.name);

    try {
      const storageRef = ref(storage, `support/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          undefined,
          (error) => reject(error),
          () => resolve(),
        );
      });

      const url = await getDownloadURL(storageRef);
      setScreenshotUrl(url);
    } catch (err) {
      console.error("Support ticket upload failed", err);
      setError("screenshotUrl", {
        message: "Upload failed. Please try again.",
      });
      setScreenshotUrl(undefined);
      setFileName(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({ ...values, screenshotUrl });
      })}
    >
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" {...register("subject")} />
        {errors.subject && (
          <p className="text-sm text-destructive">{errors.subject.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            onValueChange={(value) =>
              void setError("category", { type: "manual" })
            }
          >
            <SelectTrigger id="category" className="w-full">
              <SelectValue
                placeholder="Choose category"
                {...register("category")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="account_access">Account access</SelectItem>
              <SelectItem value="payment_failure">Payment failure</SelectItem>
              <SelectItem value="wallet_issue">Wallet issue</SelectItem>
              <SelectItem value="circle_problem">Circle problem</SelectItem>
              <SelectItem value="feature_request">Feature request</SelectItem>
              <SelectItem value="general_inquiry">General inquiry</SelectItem>
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-sm text-destructive">
              {errors.category.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <Select
            onValueChange={(value) =>
              void setError("priority", { type: "manual" })
            }
          >
            <SelectTrigger id="priority" className="w-full">
              <SelectValue
                placeholder="Choose priority"
                {...register("priority")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
          {errors.priority && (
            <p className="text-sm text-destructive">
              {errors.priority.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" rows={6} {...register("message")} />
        {errors.message && (
          <p className="text-sm text-destructive">{errors.message.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="screenshot">Attach screenshot (optional)</Label>
        <input
          id="screenshot"
          type="file"
          accept="image/*"
          className={cn(
            "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:text-white",
            uploading ? "opacity-70" : "",
          )}
          onChange={(event) => {
            const file = event.target.files?.[0];
            void handleFileChange(file);
          }}
        />
        {fileName && (
          <p className="text-sm text-muted-foreground">
            Uploaded file: {fileName}
          </p>
        )}
        {uploading && (
          <p className="text-sm text-muted-foreground">Uploading...</p>
        )}
        {errors.screenshotUrl && (
          <p className="text-sm text-destructive">
            {errors.screenshotUrl.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isLoading || uploading}
        className="w-full"
      >
        {isLoading ? "Submitting…" : "Submit ticket"}
      </Button>
    </form>
  );
}
