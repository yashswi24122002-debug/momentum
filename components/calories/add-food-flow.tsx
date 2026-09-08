"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FoodSearch } from "@/components/calories/food-search";
import { RecipeQuickLog } from "@/components/calories/recipe-quick-log";
import { BarcodeLog } from "@/components/calories/barcode-log";
import { PhotoLog } from "@/components/calories/photo-log";
import { todayLocalISODate } from "@/lib/date";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function AddFoodFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  // This used to always log to today regardless of which day was being
  // viewed on the dashboard — the dashboard's "Add Food"/"Edit previous
  // day" button now passes the date it was actually viewing via this
  // param, so an edit made from yesterday's view lands on yesterday.
  const logDate = dateParam && ISO_DATE.test(dateParam) ? dateParam : todayLocalISODate();
  const isToday = logDate === todayLocalISODate();

  function handleLogged() {
    toast.success("Back to your dashboard…");
    router.push(isToday ? "/calories" : `/calories?date=${logDate}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href={isToday ? "/calories" : `/calories?date=${logDate}`} />}
          nativeButton={false}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold text-text-primary">{isToday ? "Add Food" : `Add Food — ${logDate}`}</h1>
      </div>

      <Tabs defaultValue="search">
        <TabsList className="w-full">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="barcode">Barcode</TabsTrigger>
          <TabsTrigger value="photo">Photo</TabsTrigger>
          <TabsTrigger value="recipe">Recipe</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="pt-4">
          <FoodSearch logDate={logDate} onLogged={handleLogged} />
        </TabsContent>

        <TabsContent value="barcode" className="pt-4">
          <BarcodeLog logDate={logDate} onLogged={handleLogged} />
        </TabsContent>

        <TabsContent value="photo" className="pt-4">
          <PhotoLog logDate={logDate} onLogged={handleLogged} />
        </TabsContent>

        <TabsContent value="recipe" className="pt-4">
          <RecipeQuickLog logDate={logDate} onLogged={handleLogged} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
