"use client"

import * as z from "zod"
import axios from "axios"
import { conflictMessage } from "@/lib/api-error-message";
import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "react-hot-toast"
import { Trash } from "lucide-react"
import { Billboard, BillboardImage, Category } from "@prisma/client"
import { useParams, useRouter } from "next/navigation"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Heading } from "@/components/ui/heading"
import { AlertModal } from "@/components/modals/alert-modal"
import MultiImageUpload from "@/components/ui/multi-image-upload"
import { Switch } from "@/components/ui/switch"

import { LayoutPicker } from "./layout-picker"

// Mirrors lib/billboard.ts (server).
const MAX_PHOTOS = 5;
const MAX_SUBHEADING = 160;
const MAX_BUTTON_LABEL = 30;
// Select items cannot have an empty value.
const NO_BUTTON = "none";

const formSchema = z.object({
  label: z.string().min(1),
  images: z.object({ url: z.string() }).array().min(1, "Add at least one photo").max(MAX_PHOTOS, `A billboard can have at most ${MAX_PHOTOS} photos.`),
  layout: z.enum(["SPLIT", "FULL_BLEED", "HEADING_LED"]),
  subheading: z.string().max(MAX_SUBHEADING, `At most ${MAX_SUBHEADING} characters.`),
  showSearch: z.boolean(),
  ctaLabel: z.string().max(MAX_BUTTON_LABEL, `At most ${MAX_BUTTON_LABEL} characters.`),
  // "" = no button.
  ctaCategoryId: z.string(),
}).superRefine((values, ctx) => {
  if (values.ctaCategoryId && !values.ctaLabel.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ctaLabel"], message: "Add a button label, or choose \"No button\"." });
  }
});

type BillboardFormValues = z.infer<typeof formSchema>

type CategoryWithParent = Category & { parent: Category | null };

interface BillboardFormProps {
  initialData: (Billboard & {
    images: BillboardImage[]
  }) | null;
  categories: CategoryWithParent[];
};

const buildCategoryOptions = (categories: CategoryWithParent[]) => {
  const topLevel = categories.filter((category) => !category.parentId);

  return topLevel.flatMap((parent) => {
    const children = categories.filter((category) => category.parentId === parent.id);

    return [
      { id: parent.id, label: parent.name },
      ...children.map((child) => ({
        id: child.id,
        label: `${parent.name} → ${child.name}`,
      })),
    ];
  });
};

export const BillboardForm: React.FC<BillboardFormProps> = ({
  initialData,
  categories,
}) => {
  const params = useParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const categoryOptions = buildCategoryOptions(categories);

  const title = initialData ? 'Edit billboard' : 'Create billboard';
  const description = initialData ? 'Edit a billboard.' : 'Add a new billboard';
  const toastMessage = initialData ? 'Billboard updated.' : 'Billboard created.';
  const action = initialData ? 'Save changes' : 'Create';

  const form = useForm<BillboardFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      label: initialData.label,
      // Legacy rows without photo rows fall back to the cover.
      images: initialData.images.length > 0
        ? initialData.images.map((image) => ({ url: image.url }))
        : [{ url: initialData.imageUrl }],
      layout: initialData.layout,
      subheading: initialData.subheading ?? '',
      showSearch: initialData.showSearch,
      ctaLabel: initialData.ctaLabel ?? '',
      ctaCategoryId: initialData.ctaCategoryId ?? '',
    } : {
      label: '',
      images: [],
      layout: 'SPLIT',
      subheading: '',
      showSearch: true,
      ctaLabel: '',
      ctaCategoryId: '',
    }
  });

  const hasButton = Boolean(form.watch('ctaCategoryId'));

  const onSubmit = async (values: BillboardFormValues) => {
    const data = {
      label: values.label,
      images: values.images,
      layout: values.layout,
      subheading: values.subheading.trim() || null,
      showSearch: values.showSearch,
      ctaLabel: values.ctaCategoryId ? values.ctaLabel.trim() : null,
      ctaCategoryId: values.ctaCategoryId || null,
    };

    try {
      setLoading(true);
      if (initialData) {
        await axios.patch(`/api/${params.storeId}/billboards/${params.billboardId}`, data);
      } else {
        await axios.post(`/api/${params.storeId}/billboards`, data);
      }
      router.refresh();
      router.push(`/${params.storeId}/billboards`);
      toast.success(toastMessage);
    } catch (error: any) {
      toast.error('Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(`/api/${params.storeId}/billboards/${params.billboardId}`);
      router.refresh();
      router.push(`/${params.storeId}/billboards`);
      toast.success('Billboard deleted.');
    } catch (error: any) {
      toast.error(conflictMessage(error, 'Make sure you removed all categories using this billboard first.'));
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <>
    <AlertModal
      isOpen={open}
      onClose={() => setOpen(false)}
      onConfirm={onDelete}
      loading={loading}
    />
     <div className="heading-action-row">
        <Heading title={title} description={description} />
        {initialData && (
          <Button
            disabled={loading}
            variant="destructive"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>
      <Separator />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 w-full min-w-0">
          <p className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
            Layout, search and button apply when this billboard is your homepage billboard. Category pages show the first photo and heading.
          </p>
          <FormField
            control={form.control}
            name="layout"
            render={({ field }) => (
              <FormItem>
                <FormLabel id="billboard-layout-label">Layout</FormLabel>
                <LayoutPicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={loading}
                  labelledBy="billboard-layout-label"
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="images"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Photos</FormLabel>
                <FormControl>
                  <MultiImageUpload
                    value={field.value.map((image) => image.url)}
                    disabled={loading}
                    max={MAX_PHOTOS}
                    photoLabel="Billboard photo"
                    hint={`Up to ${MAX_PHOTOS} photos. One photo shows as a banner; two or more rotate as a carousel on the homepage.`}
                    onChange={(urls) => field.onChange(urls.map((url) => ({ url })))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid min-w-0 grid-cols-1 gap-8 md:grid-cols-2">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Heading</FormLabel>
                  <FormControl>
                    <Input disabled={loading} placeholder="Billboard heading" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subheading"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subheading (optional)</FormLabel>
                  <FormControl>
                    <Input disabled={loading} placeholder="A short line under the heading" maxLength={MAX_SUBHEADING} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="showSearch"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between gap-4 space-y-0 rounded-md border p-4">
                <div className="min-w-0 space-y-1 leading-none">
                  <FormLabel>Show search</FormLabel>
                  <FormDescription>
                    Show the product search box in the homepage hero.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={loading}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <div className="min-w-0 space-y-4 rounded-md border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">Button (optional)</p>
              <p className="text-sm text-muted-foreground">Links to one of your categories.</p>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="ctaCategoryId"
                render={({ field }) => (
                  <FormItem className="min-w-0">
                    <FormLabel>Links to</FormLabel>
                    <Select
                      disabled={loading}
                      onValueChange={(value) => field.onChange(value === NO_BUTTON ? '' : value)}
                      value={field.value || NO_BUTTON}
                    >
                      <FormControl>
                        <SelectTrigger className="min-w-0">
                          <SelectValue className="min-w-0 truncate" placeholder="No button" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_BUTTON}>No button</SelectItem>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ctaLabel"
                render={({ field }) => (
                  <FormItem className="min-w-0">
                    <FormLabel>Button label</FormLabel>
                    <FormControl>
                      <Input
                        disabled={loading || !hasButton}
                        placeholder={hasButton ? "Shop now" : "Choose a category first"}
                        maxLength={MAX_BUTTON_LABEL}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          <Button disabled={loading} className="w-full sm:ml-auto sm:w-auto" type="submit">
            {action}
          </Button>
        </form>
      </Form>
    </>
  );
};
