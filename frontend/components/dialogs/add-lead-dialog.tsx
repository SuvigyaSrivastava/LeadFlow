"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useId } from "react";
import { useForm } from "react-hook-form";

import { StatusSelect } from "@/components/leads/status-select";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { describedBy, Field, Input } from "@/components/ui/field";
import { useCreateLead } from "@/hooks/use-app-data";
import { ApiError } from "@/lib/api";
import { leadSchema, type LeadForm } from "@/lib/schemas";
import { notifyError, notifySuccess } from "@/lib/toast";
import type { Lead } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (lead: Lead) => void;
}

const EMPTY: LeadForm = { name: "", company: "", phone: "", status: "New" };

function AddLeadForm({ onDone, onCreated }: { onDone: () => void; onCreated: (lead: Lead) => void }) {
  const uid = useId();
  const mutation = useCreateLead();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadForm>({ resolver: zodResolver(leadSchema), defaultValues: EMPTY });

  const submit = handleSubmit(async (values) => {
    try {
      const lead = await mutation.mutateAsync({
        name: values.name,
        company: values.company || null,
        phone: values.phone || null,
        status: values.status,
      });
      notifySuccess("Lead added", lead.name);
      onCreated(lead);
      onDone();
    } catch (error) {
      if (error instanceof ApiError) {
        for (const f of error.fields) {
          if (f.field in EMPTY) setError(f.field as keyof LeadForm, { message: f.message });
        }
      }
      notifyError("Couldn't add the lead", error);
    }
  });

  const id = (field: string) => `${uid}-${field}`;
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id={id("name")} label="Full name" required error={errors.name?.message}>
        <Input
          id={id("name")}
          placeholder="e.g., John Doe"
          autoComplete="off"
          autoFocus
          aria-invalid={!!errors.name}
          aria-describedby={describedBy(id("name"), errors.name?.message)}
          {...register("name")}
        />
      </Field>
      <Field id={id("company")} label="Company" optional error={errors.company?.message}>
        <Input
          id={id("company")}
          placeholder="e.g., Stark Industries"
          autoComplete="off"
          aria-invalid={!!errors.company}
          aria-describedby={describedBy(id("company"), errors.company?.message)}
          {...register("company")}
        />
      </Field>
      <Field id={id("phone")} label="Phone" optional error={errors.phone?.message}>
        <Input
          id={id("phone")}
          type="tel"
          placeholder="e.g., 555-0123"
          autoComplete="off"
          aria-invalid={!!errors.phone}
          aria-describedby={describedBy(id("phone"), errors.phone?.message)}
          {...register("phone")}
        />
      </Field>
      <Field id={id("status")} label="Status">
        <StatusSelect id={id("status")} value={watch("status")} onChange={(s) => setValue("status", s)} />
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          Add lead
        </Button>
      </div>
    </form>
  );
}

export function AddLeadDialog({ open, onOpenChange, onCreated }: Props) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add lead"
      description="Only a name is required. You can log conversations once the lead exists."
    >
      {/* Remounted on every open so the form always starts clean. */}
      {open && <AddLeadForm onDone={() => onOpenChange(false)} onCreated={onCreated} />}
    </Modal>
  );
}
