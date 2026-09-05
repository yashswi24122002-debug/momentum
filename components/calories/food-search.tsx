"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Search, Star, Clock, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { LogPortionDialog } from "@/components/calories/log-portion-dialog";
import { fetcher } from "@/lib/swr-fetcher";
import type { FoodWithServings, FoodLogWithItems, FoodFavouriteWithDetails } from "@/lib/types/calories";

function FoodRow({ food, onSelect }: { food: FoodWithServings; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3 text-left hover:border-primary/50"
    >
      <div>
        <p className="text-sm text-text-primary">{food.name}</p>
        <p className="text-xs text-text-muted">
          {Math.round(food.kcal_per_100g)} kcal/100g{food.default_serving_name ? ` · ${food.default_serving_name}` : ""}
        </p>
      </div>
      <Plus className="size-4 shrink-0 text-text-muted" />
    </button>
  );
}

export function FoodSearch({ logDate, onLogged }: { logDate?: string; onLogged: (log: FoodLogWithItems) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodWithServings[] | null>(null);
  const { data: favData } = useSWR<{ favourites: FoodFavouriteWithDetails[] }>("/api/calories/favourites", fetcher);
  const { data: recentData } = useSWR<{ foods: FoodWithServings[] }>("/api/calories/foods/recent", fetcher);
  const favourites = (favData?.favourites ?? []).filter((f) => f.foods);
  const recents = recentData?.foods ?? [];
  const [selected, setSelected] = useState<FoodWithServings | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    const timeout = setTimeout(async () => {
      if (!trimmed) {
        setResults(null);
        return;
      }
      const res = await fetch(`/api/calories/foods?q=${encodeURIComponent(trimmed)}`);
      const json = await res.json();
      setResults(json.foods ?? []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods (e.g. dal, roti, poha)…" className="pl-9" />
      </div>

      {results === null ? (
        <>
          {favourites.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <Star className="size-3.5" />
                Favourites
              </h3>
              <div className="space-y-2">
                {favourites
                  .filter((f) => f.foods)
                  .map((f) => (
                    <FoodRow
                      key={f.id}
                      food={f.foods as unknown as FoodWithServings}
                      onSelect={() => setSelected(f.foods as unknown as FoodWithServings)}
                    />
                  ))}
              </div>
            </div>
          )}

          {recents.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                <Clock className="size-3.5" />
                Recent
              </h3>
              <div className="space-y-2">
                {recents.map((food) => (
                  <FoodRow key={food.id} food={food} onSelect={() => setSelected(food)} />
                ))}
              </div>
            </div>
          )}

          {favourites.length === 0 && recents.length === 0 && (
            <EmptyState icon={Search} title="Search to log a food" description="Try an Indian staple like dal, roti, or idli, or search your own saved foods." />
          )}
        </>
      ) : results.length === 0 ? (
        <div className="space-y-3">
          <EmptyState icon={Search} title="No matches" description={`Nothing found for "${query}".`} />
          <Button variant="outline" size="sm" render={<Link href="/calories/foods" />} nativeButton={false}>
            <Plus className="size-3.5" />
            Create a personal food
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((food) => (
            <FoodRow key={food.id} food={food} onSelect={() => setSelected(food)} />
          ))}
        </div>
      )}

      <LogPortionDialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        food={selected}
        logDate={logDate}
        onLogged={(log) => {
          setSelected(null);
          onLogged(log);
        }}
      />
    </div>
  );
}
