import { useState, Suspense, lazy } from 'react';
import './App.css';
import { AppProvider } from './context/AppContext';
import { loadStorage, saveStorage, generateRestaurantCode, hashPassword, completeSetup, clearStorage, registerViaApi, saveConfigToApi } from './utils/storage';
import { WelcomePage } from './components/WelcomePage';
import { RegistrationPage } from './components/RegistrationPage';
import { WaiterLoginPage } from './components/WaiterLoginPage';
import { POSLayout } from './components/pos/POSLayout';

import { Restaurant, Zone, Table, MenuItem, Staff, TableCombination, ViloStorage } from './types';
import { restaurant as demoRestaurantData, zones as demoZones, tables as demoTables, menu as demoMenu, staff as demoStaff } from './data/mockData';

const OnboardingWizard = lazy(() => import('./components/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));

type AppScreen = 'welcome' | 'register' | 'onboarding' | 'waiter-login' | 'pos';

function App() {
  const storage = loadStorage();

  const getInitialScreen = (): AppScreen => {
    if (storage.setupComplete && storage.restaurant) return 'pos';
    if (storage.owner && storage.restaurant && !storage.setupComplete) return 'onboarding';
    return 'welcome';
  };

  const [screen, setScreen] = useState<AppScreen>(getInitialScreen);
  const [restaurantName, setRestaurantName] = useState(storage.restaurant?.name || '');

  const [posConfig, setPosConfig] = useState<{
    restaurant: Restaurant;
    zones: Zone[];
    tables: Table[];
    tableCombinations: TableCombination[];
    menu: MenuItem[];
    staff: Staff[];
  } | null>(() => {
    if (storage.setupComplete && storage.restaurant) {
      return {
        restaurant: storage.restaurant,
        zones: storage.zones,
        tables: storage.tables,
        tableCombinations: storage.tableCombinations || [],
        menu: storage.menu,
        staff: storage.staff,
      };
    }
    return null;
  });

  const handleRegister = async (name: string, email: string, password: string) => {
    const code = generateRestaurantCode();
    const restaurantName = name + 's Restaurant';
    const passwordHash = await hashPassword(password);

    const persistAndContinue = (owner: {
      id: string;
      name: string;
      email: string;
      passwordHash: string;
      restaurantId: string;
    }, restaurant: Restaurant) => {
      saveStorage({ owner, restaurant, onboardingStep: 0, setupComplete: false });
      setRestaurantName(restaurant.name);
      setScreen('onboarding');
    };

    try {
      const { restaurant, owner } = await registerViaApi(name, email, passwordHash, restaurantName, code);
      persistAndContinue(owner as {
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        restaurantId: string;
      }, restaurant as Restaurant);
    } catch (e) {
      console.warn('[VILO] Backend registration failed, using local:', e);
      const restaurantId = Math.random().toString(36).substring(2, 9);
      const owner = {
        id: Math.random().toString(36).substring(2, 9),
        name,
        email,
        passwordHash,
        restaurantId,
      };
      const restaurant: Restaurant = {
        id: restaurantId,
        name: restaurantName,
        code,
        currency: 'EUR',
        taxRate: 19,
      };
      persistAndContinue(owner, restaurant);
    }
  };

  const handleOnboardingComplete = async (data: { zones: Zone[]; tables: Table[]; menu: MenuItem[]; staff: Staff[] }) => {
    const currentStorage = loadStorage();
    const restaurant = currentStorage.restaurant!;
    saveStorage({ zones: data.zones, tables: data.tables, menu: data.menu, staff: data.staff });
    completeSetup();
    await saveConfigToApi(restaurant.id, data.zones, data.tables, data.menu, data.staff, true, 4);
    setPosConfig({ restaurant, zones: data.zones, tables: data.tables, tableCombinations: currentStorage.tableCombinations || [], menu: data.menu, staff: data.staff });
    setScreen('pos');
  };

  const handleQuickStart = async () => {
    const currentStorage = loadStorage();
    const code = currentStorage.restaurant?.code || generateRestaurantCode();

    try {
      const { restaurant } = await registerViaApi('Demo', 'demo@vilo.app', 'demo', 'Demo Restaurant', code);
      const demoR = { ...restaurant, ...demoRestaurantData, code: restaurant.code, id: restaurant.id };
      saveStorage({ restaurant: demoR, zones: demoZones, tables: demoTables, menu: demoMenu, staff: demoStaff });
      completeSetup();
      await saveConfigToApi(demoR.id, demoZones, demoTables, demoMenu, demoStaff, true, 4);
      setPosConfig({ restaurant: demoR, zones: demoZones, tables: demoTables, tableCombinations: [], menu: demoMenu, staff: demoStaff });
    } catch (e) {
      console.warn('[VILO] Backend quickstart failed, using local:', e);
      const restaurant = { ...demoRestaurantData, code };
      saveStorage({ restaurant, zones: demoZones, tables: demoTables, menu: demoMenu, staff: demoStaff });
      completeSetup();
      setPosConfig({ restaurant, zones: demoZones, tables: demoTables, tableCombinations: [], menu: demoMenu, staff: demoStaff });
    }
    setScreen('pos');
  };

  const handleWaiterLogin = (_staff: Staff, restaurantData: ViloStorage | null) => {
    if (!restaurantData || !restaurantData.restaurant) return;
    setPosConfig({
      restaurant: restaurantData.restaurant,
      zones: restaurantData.zones,
      tables: restaurantData.tables,
      tableCombinations: restaurantData.tableCombinations || [],
      menu: restaurantData.menu,
      staff: restaurantData.staff,
    });
    setRestaurantName(restaurantData.restaurant.name);
    setScreen('pos');
  };

  const handleLogout = () => {
    setScreen('welcome');
    setPosConfig(null);
  };

  const handleReset = () => {
    clearStorage();
    setScreen('welcome');
    setPosConfig(null);
    setRestaurantName('');
  };

  switch (screen) {
    case 'welcome':
      return (
        <WelcomePage
          onCreateRestaurant={() => setScreen('register')}
          onWaiterLogin={() => setScreen('waiter-login')}
        />
      );
    case 'register':
      return (
        <RegistrationPage
          onBack={() => setScreen('welcome')}
          onRegister={handleRegister}
        />
      );
    case 'onboarding':
      return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center h-screen bg-[#1a1a2e]"><div className="w-6 h-6 border-2 border-[#7bb7ef] border-t-transparent rounded-full animate-spin" /></div>}>
          <OnboardingWizard
            restaurantName={restaurantName}
            onComplete={handleOnboardingComplete}
            onBack={() => handleReset()}
            onQuickStart={handleQuickStart}
          />
        </Suspense>
      );
    case 'waiter-login':
      return (
        <WaiterLoginPage
          onBack={() => setScreen('welcome')}
          onLogin={handleWaiterLogin}
        />
      );
    case 'pos':
      if (!posConfig) {
        setScreen('welcome');
        return null;
      }
      return (
        <AppProvider config={posConfig}>
          <POSLayout onLogout={handleLogout} />
        </AppProvider>
      );
  }
}

export default App;
