import { Nav } from "@/components/Nav";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsPager } from "@/components/docs/DocsPager";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * The documentation shell.
 *
 * Contents, article column and the previous/next pager, shared by every page so a new topic is one
 * content file and one line in the map. Nothing here animates in: the landing page argues,
 * documentation gets read in a hurry, and content that waits for a scroll trigger is content that
 * can fail to arrive.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
        <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
          <DocsSidebar />

          <article className="mt-10 min-w-0 lg:mt-0">
            {children}

            <DocsPager />
          </article>
        </div>

        <SiteFooter />
      </main>
    </>
  );
}
