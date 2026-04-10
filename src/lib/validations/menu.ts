import { z } from "zod";

export const menuCategorySchema = z.object({
  nameEn: z.string().min(1, "English name is required"),
  nameZh: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export const menuItemSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  nameEn: z.string().min(1, "English name is required"),
  nameZh: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  descriptionEn: z.string().optional(),
  descriptionZh: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  advanceDaysRequired: z.number().int().min(0).default(0),
  sortOrder: z.number().int().default(0),
});

export type MenuCategoryInput = z.infer<typeof menuCategorySchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
