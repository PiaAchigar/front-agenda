import { useState } from "react";
import { useCategories, useServices } from "../../api/agenda";
import type { Category, Service } from "../../api/types";
import { Card, ErrorNote, Spinner } from "../../components/ui";

function CategoryBranch({
  category,
  selectedId,
  onSelect,
  depth = 0,
}: {
  category: Category;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  return (
    <div style={{ marginLeft: depth * 12 }}>
      <button
        className={`block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
          selectedId === category.id
            ? "bg-primary-container/40 font-medium text-primary-dark"
            : "hover:bg-surface-high"
        }`}
        onClick={() => onSelect(category.id)}
      >
        {category.name}
      </button>
      {category.children.map((child) => (
        <CategoryBranch
          key={child.id}
          category={child}
          selectedId={selectedId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function StepService({ onSelect }: { onSelect: (service: Service) => void }) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const categories = useCategories();
  const services = useServices(categoryId ?? undefined);

  return (
    <div className="grid gap-5 md:grid-cols-[240px_1fr]">
      <Card>
        <h3 className="mb-3 text-lg font-semibold">Categorías</h3>
        {categories.isLoading && <Spinner />}
        {categories.error && <ErrorNote message={(categories.error as Error).message} />}
        <button
          className={`mb-1 block w-full rounded-lg px-3 py-1.5 text-left text-sm ${
            categoryId === null ? "bg-primary-container/40 font-medium" : "hover:bg-surface-high"
          }`}
          onClick={() => setCategoryId(null)}
        >
          Todas
        </button>
        {categories.data?.map((cat) => (
          <CategoryBranch
            key={cat.id}
            category={cat}
            selectedId={categoryId}
            onSelect={setCategoryId}
          />
        ))}
      </Card>

      <div>
        {services.isLoading && <Spinner />}
        {services.error && <ErrorNote message={(services.error as Error).message} />}
        <div className="grid gap-3 sm:grid-cols-2">
          {services.data?.map((svc) => (
            <Card key={svc.id} className="transition-shadow hover:shadow-md">
              <button className="w-full text-left" onClick={() => onSelect(svc)}>
                <h4 className="text-lg font-semibold">{svc.name}</h4>
                <p className="mt-1 text-xs text-ink-soft">
                  {svc.estimatedDurationMinutes ?? "?"} min
                </p>
                <div className="mt-2 flex gap-3 text-sm">
                  {svc.unitPriceList != null && (
                    <span className="font-medium text-primary">
                      ${svc.unitPriceList.toLocaleString("es-AR")}
                    </span>
                  )}
                  {svc.unitPriceCash != null && (
                    <span className="text-ink-soft">
                      efectivo ${svc.unitPriceCash.toLocaleString("es-AR")}
                    </span>
                  )}
                </div>
              </button>
            </Card>
          ))}
          {services.data?.length === 0 && (
            <p className="text-sm text-ink-soft">No hay servicios en esta categoría.</p>
          )}
        </div>
      </div>
    </div>
  );
}
