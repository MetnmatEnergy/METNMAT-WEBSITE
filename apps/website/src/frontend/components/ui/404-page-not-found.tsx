import { Button } from "@/frontend/components/ui/button";

/**
 * Animated 404 page. Adapted to this codebase:
 *  - uses the project's own <Button href> (renders a Next <Link>) instead of an
 *    undefined `router.push` — so no client JS is needed (server component).
 *  - the background GIF is self-hosted at /404.gif because the site's CSP
 *    (img-src 'self') blocks external image hosts like cdn.dribbble.com.
 */
export function NotFoundPage() {
  return (
    <section className="bg-white font-serif min-h-screen flex items-center justify-center">
      <div className="container mx-auto">
        <div className="flex justify-center">
          <div className="w-full sm:w-10/12 md:w-8/12 text-center">
            <div
              className="bg-[url(/404.gif)] h-[250px] sm:h-[350px] md:h-[400px] bg-center bg-no-repeat bg-contain"
              aria-hidden="true"
            >
              <h1 className="text-center text-black text-6xl sm:text-7xl md:text-8xl pt-6 sm:pt-8">
                404
              </h1>
            </div>

            <div className="mt-[-50px]">
              <h3 className="text-2xl text-black sm:text-3xl font-bold mb-4">
                Look like you&apos;re lost
              </h3>
              <p className="mb-6 text-black sm:mb-5">
                The page you are looking for is not available!
              </p>

              <Button
                href="/"
                className="my-5 bg-green-600 text-white hover:bg-green-700"
              >
                Go to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
