import { useForm, Control, useFormContext, UseFormReturn, FieldValues } from "react-hook-form";
import type { Path } from "react-hook-form";
import { Form as FormProvider, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import React from "react";
import { z } from "zod";
import { clientFormSchema } from "@/pages/client-management";
import { cn } from "@/lib/utils";

export type ClientFormValues = z.infer<typeof clientFormSchema>;

type CompatibleFormControl<T extends FieldValues> = Control<T> & {
  _defaultValues?: T;
  _formValues?: T;
};

type TypedFormFieldProps<TFieldValues extends FieldValues, TName extends Path<TFieldValues>> = {
  control: Control<TFieldValues>;
  name: TName;
  render: (props: {
    field: {
      value: TFieldValues[TName];
      onChange: (value: TFieldValues[TName] | ((prev: TFieldValues[TName]) => TFieldValues[TName])) => void;
      onBlur: () => void;
      name: TName;
      ref: React.RefCallback<HTMLInputElement>;
    };
    fieldState: {
      invalid: boolean;
      isDirty: boolean;
      isTouched: boolean;
      error?: { message?: string };
    };
    formState: any;
  }) => React.ReactElement;
};

interface ClientFormProps {
  control?: CompatibleFormControl<ClientFormValues>;
  onSubmit: (data: ClientFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  isEdit?: boolean;
  client?: ClientFormValues;
  children?: React.ReactNode;
  form?: UseFormReturn<ClientFormValues>;
}

export const ClientForm: React.FC<ClientFormProps> = ({
  control: externalControl,
  onSubmit,
  onCancel,
  isSubmitting = false,
  isEdit = false,
  client,
  children,
  form: externalForm,
}: ClientFormProps) => {
  const formContext = useFormContext<ClientFormValues>();
  const form = externalForm || formContext;
  const control = externalControl || (form?.control as CompatibleFormControl<ClientFormValues>);

  if (!control) {
    throw new Error('ClientForm must be used within a FormProvider or have a control prop');
  }

  const { handleSubmit } = form || {};

  const onFormSubmit = (data: ClientFormValues) => {
    onSubmit(data);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (handleSubmit) {
      handleSubmit(onFormSubmit)(e);
    } else {
      console.error('Form submission handler not available');
    }
  };

  return (
    <div className={cn("space-y-4", {
      'opacity-50 pointer-events-none': isSubmitting
    })}>
      <form onSubmit={handleFormSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="firstName">First Name</FormLabel>
                <FormControl>
                  <Input 
                    {...field}
                    id="firstName"
                    type="text"
                    value={field.value ?? ''}
                    data-testid="first-name"
                    autoComplete="given-name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="lastName">Last Name</FormLabel>
                <FormControl>
                  <Input 
                    {...field}
                    id="lastName"
                    type="text"
                    value={field.value ?? ''}
                    data-testid="last-name"
                    autoComplete="family-name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="email">Email</FormLabel>
              <FormControl>
                <Input 
                  {...field}
                  id="email"
                  type="email"
                  value={field.value ?? ''}
                  data-testid="email"
                  autoComplete="email"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="phone">Phone</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  id="phone"
                  type="tel"
                  value={field.value ?? ''}
                  data-testid="phone"
                  autoComplete="tel"
                  placeholder="e.g., +1 555 123 4567"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
<FormField
            control={control}
            name="currentWeight"
            render={({ field }) => {
              const value = field.value as number | null;
              return (
                <FormItem>
                  <FormLabel htmlFor="currentWeight">Current Weight (kg)</FormLabel>
                  <FormControl>
                    <Input 
                      id="currentWeight"
                      name="currentWeight"
                      type="number"
                      step="0.1"
                      min="0"
                      value={value ?? ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        field.onChange(newValue === '' ? null : Number(newValue));
                      }}
                      data-testid="current-weight"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
<FormField
            control={control}
            name="targetWeight"
            render={({ field }) => {
              const value = field.value as number | null;
              return (
                <FormItem>
                  <FormLabel htmlFor="targetWeight">Target Weight (kg)</FormLabel>
                  <FormControl>
                    <Input 
                      id="targetWeight"
                      name="targetWeight"
                      type="number"
                      step="0.1"
                      min="0"
                      value={value ?? ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        field.onChange(newValue === '' ? null : Number(newValue));
                      }}
                      data-testid="target-weight"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
<FormField
            control={control}
            name="goals"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="goals">Goals</FormLabel>
                <FormControl>
                  <Textarea
                    id="goals"
                    placeholder="Enter client's goals..."
                    className="min-h-[100px]"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    data-testid="goals"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Generate temp password toggle */}
        <FormField
          control={control}
          name="generateTempPassword"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <input
                  id="generateTempPassword"
                  type="checkbox"
                  checked={Boolean(field.value)}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <FormLabel htmlFor="generateTempPassword" className="!mt-0">Generate temporary password for new user</FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isEdit ? 'Updating...' : 'Creating...'}
              </span>
            ) : isEdit ? (
              'Update Client'
            ) : (
              'Create Client'
            )}
          </Button>
        </div>
        {children}
      </form>
    </div>
  );
}
