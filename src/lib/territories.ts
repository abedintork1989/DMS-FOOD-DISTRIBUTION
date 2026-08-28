import { supabase } from "@/lib/supabase";

export type TerritoryGeometry = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};

export type CreateTerritoryInput = {
  name: string;
  type: string;
  parent_id: string;
  active?: boolean;
  geometry?: TerritoryGeometry | null;
  sales_channels?: string[];
};

export async function getRootTerritories() {
  const { data, error } = await supabase
    .from("territories")
    .select("*")
    .is("parent_id", null)
    .order("name");

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getChildren(parentId: string) {
  const { data, error } = await supabase
    .from("territories")
    .select("*")
    .eq("parent_id", parentId)
    .order("name");

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getTerritoryDetails(id: string) {
  const { data, error } = await supabase
    .from("territories")
    .select(`
      *,
      parent:parent_id(
        id,
        name,
        type,
        geometry
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createTerritory(
  input: CreateTerritoryInput
) {
  const { data, error } = await supabase
    .from("territories")
    .insert({
      name: input.name.trim(),
      type: input.type,
      parent_id: input.parent_id,
      active: input.active !== false,
      geometry: input.geometry ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (
    input.sales_channels &&
    input.sales_channels.length > 0
  ) {
    const channels = input.sales_channels.map(
      (salesChannelId) => ({
        territory_id: data.id,
        sales_channel_id: salesChannelId,
      })
    );

    const { error: channelError } = await supabase
      .from("territory_sales_channels")
      .insert(channels);

    if (channelError) {
      throw channelError;
    }
  }

  return data;
}

export async function updateTerritoryGeometry(
  territoryId: string,
  geometry: TerritoryGeometry | null
) {
  const { data, error } = await supabase
    .from("territories")
    .update({
      geometry,
    })
    .eq("id", territoryId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}