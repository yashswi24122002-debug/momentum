import { SettingsForm } from "@/components/calories/settings-form";

export default function Page() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <h1 className="text-xl font-semibold text-text-primary">Calorie Settings</h1>
      <SettingsForm />
    </div>
  );
}
