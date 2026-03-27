import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, ArrowUpDown, Calculator, List } from 'lucide-react';
import StockStandardTab from './tabs/StockStandardTab';
import StockMouvementsTab from './tabs/StockMouvementsTab';
import StockCUMPTab from './tabs/StockCUMPTab';
import StockList from './StockList';

export default function StockModule() {
  const [activeTab, setActiveTab] = useState('standard');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Stock
          </h1>
          <p className="text-muted-foreground">
            Gestion dynamique basée sur les mouvements — source unique de vérité
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="standard" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Vue KIMBO</span>
              <span className="sm:hidden">Stock</span>
            </TabsTrigger>
            <TabsTrigger value="articles" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Articles</span>
              <span className="sm:hidden">Art.</span>
            </TabsTrigger>
            <TabsTrigger value="mouvements" className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">Mouvements</span>
              <span className="sm:hidden">Mvts</span>
            </TabsTrigger>
            <TabsTrigger value="cump" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              CUMP
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standard">
            <StockStandardTab />
          </TabsContent>
          <TabsContent value="articles">
            <StockList embedded />
          </TabsContent>
          <TabsContent value="mouvements">
            <StockMouvementsTab />
          </TabsContent>
          <TabsContent value="cump">
            <StockCUMPTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
