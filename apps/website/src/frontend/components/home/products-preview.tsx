import { Container } from "@/frontend/components/ui/container";
import { Button } from "@/frontend/components/ui/button";
import { SectionHeading } from "@/frontend/components/ui/section-heading";
import { CatalogProductCard } from "@/frontend/components/commerce/catalog-product-card";
import { getFeaturedProducts } from "@/frontend/lib/cms";

export async function ProductsPreview() {
  const products = await getFeaturedProducts(4);
  return (
    <section className="section">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Shop"
            title="High Quality Research Grade Products"
            description="Featured items from the catalog. Replace with real products or wire to the API."
          />
          <Button href="/shop" variant="outline" size="sm">
            Visit shop
          </Button>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <CatalogProductCard key={product.slug} product={product} />
          ))}
        </div>
      </Container>
    </section>
  );
}
