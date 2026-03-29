import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play } from "lucide-react";

export default function DesignSystemPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div>
        <h1 className="text-4xl font-serif text-foreground mb-2">Design System</h1>
        <p className="text-muted-foreground">BogglTrack UI aesthetics and atomic components</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-serif border-b pb-2">Colors</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ColorSwatch bg="bg-background" text="Sage Background" hex="#C5CEB5" />
          <ColorSwatch bg="bg-card" text="Warm Cream Surface" hex="#FAF8F2" />
          <ColorSwatch bg="bg-foreground" text="Forest Green Text" hex="#1B3A2D" textClass="text-card" />
          <ColorSwatch bg="bg-muted-foreground" text="Muted Olive" hex="#5C7A5E" textClass="text-card" />
          <ColorSwatch bg="bg-primary" text="Olive Lime (Primary)" hex="#C8D84E" />
          <ColorSwatch bg="bg-secondary" text="Soft Coral" hex="#E8A5A0" />
          <ColorSwatch bg="bg-accent" text="Active Accent" hex="#B5C438" />
          <ColorSwatch bg="bg-chart-4" text="Golden Olive" hex="#D4D08E" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-serif border-b pb-2">Typography</h2>
        <Card className="shadow-sm border-transparent">
          <CardContent className="space-y-6 pt-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Heading 1 (Serif)</p>
              <h1 className="text-4xl font-serif">Hello, Budi</h1>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Heading 2 (Serif)</p>
              <h2 className="text-2xl font-serif">Calendar</h2>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Data Display Large (Sans, Medium)</p>
              <p className="text-5xl font-medium tracking-tight">20:37:16</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Entry Description (Sans, Regular)</p>
              <p className="text-lg text-foreground">Branding assets update</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Label / Meta (Sans)</p>
              <p className="text-sm text-muted-foreground">Now - Mon, May 25</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-serif border-b pb-2">Components</h2>
        <div className="grid md:grid-cols-2 gap-8">
          
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-3">Tab Toggles</h3>
              <Tabs defaultValue="ongoing" className="w-[400px]">
                <TabsList className="bg-transparent h-12 p-1 gap-1 border border-border rounded-full w-full">
                  <TabsTrigger value="ongoing" className="rounded-full w-1/2 data-[state=active]:bg-foreground data-[state=active]:text-card font-medium transition-colors">
                    Ongoing
                  </TabsTrigger>
                  <TabsTrigger value="previous" className="rounded-full w-1/2 text-muted-foreground font-medium hover:text-foreground transition-colors">
                    Previous day
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div>
              <h3 className="font-medium mb-3">Pills & Badges</h3>
              <div className="flex gap-3 flex-wrap">
                <Badge variant="outline" className="text-secondary font-normal border-secondary/30 bg-secondary/10 px-3 py-1 text-sm rounded-full">Real estate client</Badge>
                <Badge variant="outline" className="text-chart-4 font-normal border-chart-4/30 bg-chart-4/10 px-3 py-1 text-sm rounded-full">Digital agency site</Badge>
                <Badge variant="outline" className="text-muted-foreground font-normal border-muted-foreground/30 bg-muted px-3 py-1 text-sm rounded-full">Nonprofit website</Badge>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">Buttons</h3>
              <div className="flex items-center gap-4">
                <Button className="rounded-full px-6 font-medium bg-primary text-foreground hover:bg-accent transition-colors shadow-sm">
                  Start Timer
                </Button>
                <Button variant="outline" className="rounded-full px-6 font-medium border-border hover:bg-muted">
                  Cancel
                </Button>
                <button className="h-10 w-10 bg-primary hover:bg-accent text-foreground rounded-full flex items-center justify-center transition-colors shadow-sm cursor-pointer">
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="font-medium mb-3">Time Entry Row (Card Item)</h3>
            <Card className="border-transparent shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-lg text-foreground leading-none">Hero section animation</span>
                    <div>
                      <Badge variant="outline" className="text-secondary font-normal border-secondary/30 bg-secondary/10 px-2.5 py-0.5 text-xs rounded-full">
                        Startup landing page
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-medium tracking-tight text-foreground/90">0:48:10</span>
                    <button className="h-9 w-9 bg-primary hover:bg-accent text-foreground rounded-full flex items-center justify-center transition-colors shadow-sm cursor-pointer">
                      <Play className="h-4 w-4 fill-current ml-0.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </section>
    </div>
  );
}

function ColorSwatch({ bg, text, hex, textClass = "text-foreground" }: { bg: string, text: string, hex: string, textClass?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
      <div className={`h-24 w-full ${bg}`} />
      <div className="bg-card p-3">
        <p className={`text-sm font-medium ${textClass}`}>{text}</p>
        <p className="text-xs text-muted-foreground uppercase">{hex}</p>
      </div>
    </div>
  );
}
