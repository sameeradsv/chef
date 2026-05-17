import { RECIPE_IDS } from "@/data/recipe-ids";
import { RecipeClient } from "./RecipeClient";

export function generateStaticParams() {
  return RECIPE_IDS.map((id) => ({ id }));
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RecipeClient id={id} />;
}
