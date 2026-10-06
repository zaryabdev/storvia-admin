"use client"

import * as z from "zod"
import axios from "axios"
import { conflictMessage } from "@/lib/api-error-message";
import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "react-hot-toast"
import { Trash } from "lucide-react"
import { Billboard, Category } from "@prisma/client"
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
import { Separator } from "@/components/ui/separator"
import { Heading } from "@/components/ui/heading"
import { AlertModal } from "@/components/modals/alert-modal"
import { CategoryIconPicker } from "@/components/category-icon-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const NONE_VALUE = "none";

const formSchema = z.object({
  name: z.string().min(2),
  billboardId: z.string(),
  parentId: z.string(),
  iconKey: z.string(),
}).superRefine((data, ctx) => {
  if (data.parentId === NONE_VALUE && data.billboardId === NONE_VALUE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Billboard is required for a top-level category",
      path: ["billboardId"],
    });
  }
});

type CategoryFormValues = z.infer<typeof formSchema>

interface CategoryFormProps {
  initialData: (Category & { children: Category[] }) | null;
  billboards: Billboard[];
  categories: Category[];
};

export const CategoryForm: React.FC<CategoryFormProps> = ({
  initialData,
  billboards,
  categories,
}) => {
  const params = useParams();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = initialData ? 'Edit category' : 'Create category';
  const description = initialData ? 'Edit a category.' : 'Add a new category';
  const toastMessage = initialData ? 'Category updated.' : 'Category created.';
  const action = initialData ? 'Save changes' : 'Create';

  const hasChildren = !!initialData && initialData.children.length > 0;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData ? {
      name: initialData.name,
      billboardId: initialData.billboardId || NONE_VALUE,
      parentId: initialData.parentId || NONE_VALUE,
      iconKey: initialData.iconKey ?? '',
    } : {
      name: '',
      billboardId: NONE_VALUE,
      parentId: NONE_VALUE,
      iconKey: '',
    }
  });

  const onSubmit = async (data: CategoryFormValues) => {
    try {
      setLoading(true);
      const payload = {
        name: data.name,
        billboardId: data.billboardId === NONE_VALUE ? null : data.billboardId,
        parentId: data.parentId === NONE_VALUE ? null : data.parentId,
        iconKey: data.iconKey || null,
      };
      if (initialData) {
        await axios.patch(`/api/${params.storeId}/categories/${params.categoryId}`, payload);
      } else {
        await axios.post(`/api/${params.storeId}/categories`, payload);
      }
      router.refresh();
      router.push(`/${params.storeId}/categories`);
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
      await axios.delete(`/api/${params.storeId}/categories/${params.categoryId}`);
      router.refresh();
      router.push(`/${params.storeId}/categories`);
      toast.success('Category deleted.');
    } catch (error: any) {
      toast.error(conflictMessage(error, 'Make sure you removed all products using this category first.'));
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 w-full">
          <div className="grid min-w-0 grid-cols-1 gap-8 md:grid-cols-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input disabled={loading} placeholder="Category name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Category</FormLabel>
                  <Select disabled={loading || hasChildren} onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-w-0">
                        <SelectValue className="min-w-0 truncate" defaultValue={field.value} placeholder="Select a parent category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None — Top-level category</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasChildren && (
                    <FormDescription className="break-words">
                      This category has child categories and cannot be moved under another category.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="billboardId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billboard</FormLabel>
                  <Select disabled={loading} onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="min-w-0">
                        <SelectValue className="min-w-0 truncate" defaultValue={field.value} placeholder="Select a billboard" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {billboards.map((billboard) => (
                        <SelectItem key={billboard.id} value={billboard.id}>{billboard.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="iconKey"
            render={({ field }) => (
              <FormItem className="min-w-0">
                <FormLabel>Icon (optional)</FormLabel>
                <FormControl>
                  <CategoryIconPicker
                    value={field.value}
                    onChange={field.onChange}
                    disabled={loading}
                  />
                </FormControl>
                <FormDescription>
                  Shown before the category name in your Storefront.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button disabled={loading} className="w-full sm:ml-auto sm:w-auto" type="submit">
            {action}
          </Button>
        </form>
      </Form>
    </>
  );
};
