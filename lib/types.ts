export type Ingredient = {
  name: string;
  amount?: string | null;
  unit?: string | null;
  group?: string | null;
};

export type Recipe = {
  id: string;
  title: string;
  source_url: string | null;
  platform: string | null;
  thumbnail_url: string | null;
  servings: number | null;
  time_minutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  rating: number | null;
  status: "to_try" | "tried";
  notes: string | null;
  last_cooked_at: string | null;
  is_complete: boolean;
  created_at: string;
};