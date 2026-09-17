import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import CuisineTiles from './components/CuisineTiles';
import TopPicks from './components/TopPicks';
import SearchResults from './components/SearchResults';
import LucknowLocationPanel from './components/LucknowLocationPanel';
import Footer from './components/Footer';
import { fetchAppConfig, fetchLucknowAreas, fetchTopPicks, searchDishes } from './api/foodApi';
import { ACTIVE_CITY, TOP_PICKS_LIMIT, DEFAULT_SEARCH_LIMIT } from './config';

export default function App() {
  // BHOOK is temporarily operating in Lucknow-only mode.
  const selectedCity = ACTIVE_CITY;
  const [lucknowAreas, setLucknowAreas] = useState([]);
  const [lucknowAreasLoading, setLucknowAreasLoading] = useState(true);
  const [lucknowAreasError, setLucknowAreasError] = useState(null);
  const [selectedLucknowAreaSlug, setSelectedLucknowAreaSlug] = useState('');
  const [maximumLucknowDistanceKm, setMaximumLucknowDistanceKm] = useState(15);
  const [livePriceCheckEnabled, setLivePriceCheckEnabled] = useState(false);

  // Top Picks State (Homepage)
  const [topPicks, setTopPicks] = useState([]);
  const [topPicksLoading, setTopPicksLoading] = useState(true);
  const [topPicksError, setTopPicksError] = useState(null);

  // Search State
  const [searchDish, setSearchDish] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchLoadMoreError, setSearchLoadMoreError] = useState(null);
  const [searchPagination, setSearchPagination] = useState({
    total: 0,
    has_more: false,
    next_offset: null,
  });
  const [searchError, setSearchError] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const searchSectionRef = useRef(null);
  const heroSearchRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  const selectedLucknowArea = lucknowAreas.find(
    (area) => area.slug === selectedLucknowAreaSlug,
  ) || null;
  const selectedLucknowAreaName = selectedLucknowArea?.name || '';

  useEffect(() => {
    let ignore = false;
    fetchLucknowAreas()
      .then((data) => {
        if (ignore) return;
        setLucknowAreas(data.areas);
        setMaximumLucknowDistanceKm(data.maximumDistanceKm);
      })
      .catch((error) => {
        if (!ignore) setLucknowAreasError(error.message);
      })
      .finally(() => {
        if (!ignore) setLucknowAreasLoading(false);
      });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    fetchAppConfig()
      .then((config) => {
        if (!ignore) setLivePriceCheckEnabled(config.livePriceCheck);
      })
      .catch(() => {
        if (!ignore) setLivePriceCheckEnabled(false);
      });
    return () => { ignore = true; };
  }, []);

  // Fetch Top Picks on mount or when selectedCity changes
  useEffect(() => {
    let ignore = false;
    async function runFetch() {
      setTopPicksLoading(true);
      setTopPicksError(null);
      try {
        const data = await fetchTopPicks({
          limit: TOP_PICKS_LIMIT,
          city: selectedCity,
          area: selectedCity === 'Lucknow' ? selectedLucknowAreaName : '',
        });
        if (!ignore) {
          setTopPicks(data);
        }
      } catch (err) {
        if (!ignore) {
          setTopPicksError(err.message || 'Unable to connect to the BHOOK API');
        }
      } finally {
        if (!ignore) {
          setTopPicksLoading(false);
        }
      }
    }

    runFetch();
    return () => {
      ignore = true;
    };
  }, [selectedCity, selectedLucknowAreaName]);

  const reloadTopPicks = useCallback(async () => {
    setTopPicksLoading(true);
    setTopPicksError(null);
    try {
      const data = await fetchTopPicks({
        limit: TOP_PICKS_LIMIT,
        city: selectedCity,
        area: selectedCity === 'Lucknow' ? selectedLucknowAreaName : '',
      });
      setTopPicks(data);
    } catch (err) {
      setTopPicksError(err.message || 'Unable to connect to the BHOOK API');
    } finally {
      setTopPicksLoading(false);
    }
  }, [selectedCity, selectedLucknowAreaName]);

  // Execute search. The backend owns ranking so every client uses the same
  // Best Value Score ordering and best-match marker.
  const executeSearch = useCallback(async ({ dish, maxPrice: priceLimit, area: areaParam }) => {
    const queryDish = typeof dish === 'string' ? dish.trim() : '';
    const activeMaxPrice = priceLimit !== undefined ? priceLimit : maxPrice;
    if (!queryDish && !(Number(activeMaxPrice) > 0)) return;

    setSearchDish(queryDish);
    setIsSearching(true);
    setSearchLoading(true);
    setSearchError(null);
    setSearchLoadMoreError(null);

    const activeCity = ACTIVE_CITY;
    const activeArea = areaParam !== undefined ? areaParam : selectedLucknowAreaName;
    const requestId = ++searchRequestIdRef.current;

    if (priceLimit !== undefined) setMaxPrice(activeMaxPrice);

    try {
      const response = await searchDishes({
        dish: queryDish,
        max_price: activeMaxPrice,
        city: activeCity,
        area: activeArea,
        limit: DEFAULT_SEARCH_LIMIT,
        offset: 0,
      });

      const returnedQuery = typeof response?.query === 'string'
        ? response.query
        : queryDish;
      const rankedResults = Array.isArray(response?.results)
        ? response.results
        : [];

      if (requestId !== searchRequestIdRef.current) return;

      setSearchDish(returnedQuery);
      setSearchResults(rankedResults);
      setSearchPagination(response?.pagination || {
        total: rankedResults.length,
        has_more: false,
        next_offset: null,
      });

      // Smooth scroll to search results container
      setTimeout(() => {
        if (searchSectionRef.current) {
          searchSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      if (requestId !== searchRequestIdRef.current) return;
      setSearchError(err.message || 'Error occurred while fetching search results');
      setSearchResults([]);
      setSearchPagination({ total: 0, has_more: false, next_offset: null });
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearchLoading(false);
      }
    }
  }, [maxPrice, selectedLucknowAreaName]);

  const loadMoreSearchResults = useCallback(async () => {
    if (searchLoadingMore || !searchPagination.has_more) return;
    const requestId = searchRequestIdRef.current;
    setSearchLoadingMore(true);
    setSearchLoadMoreError(null);
    try {
      const response = await searchDishes({
        dish: searchDish,
        max_price: maxPrice,
        city: ACTIVE_CITY,
        area: selectedLucknowAreaName,
        limit: DEFAULT_SEARCH_LIMIT,
        offset: searchPagination.next_offset || searchResults.length,
      });
      if (requestId !== searchRequestIdRef.current) return;
      setSearchResults((current) => {
        const existingIds = new Set(current.map((item) => item.item_id));
        return [...current, ...response.results.filter((item) => !existingIds.has(item.item_id))];
      });
      setSearchPagination(response.pagination);
    } catch (err) {
      if (requestId === searchRequestIdRef.current) {
        setSearchLoadMoreError(err.message || 'Unable to load more results');
      }
    } finally {
      if (requestId === searchRequestIdRef.current) setSearchLoadingMore(false);
    }
  }, [
    maxPrice,
    searchDish,
    searchLoadingMore,
    searchPagination,
    searchResults.length,
    selectedLucknowAreaName,
  ]);

  // Handle Cuisine Tile Selection
  const handleSelectCuisine = (keyword) => {
    setSearchDish(keyword);
    executeSearch({
      dish: keyword,
      maxPrice,
      city: selectedCity,
      area: selectedCity === 'Lucknow' ? selectedLucknowAreaName : '',
    });
  };

  // Update filters in search mode
  const handleUpdateSearchFilters = ({ maxPrice: newPrice }) => {
    const updatedPrice = newPrice !== undefined ? newPrice : maxPrice;

    if (newPrice !== undefined) setMaxPrice(newPrice);

    if (!searchDish && !(Number(updatedPrice) > 0)) {
      handleClearSearch();
      return;
    }

    executeSearch({
      dish: searchDish,
      maxPrice: updatedPrice,
      city: ACTIVE_CITY,
      area: selectedLucknowAreaName,
    });
  };

  const handleLucknowAreaChange = (slug) => {
    setSelectedLucknowAreaSlug(slug);
    const areaName = lucknowAreas.find((area) => area.slug === slug)?.name || '';
    if (isSearching && (searchDish || Number(maxPrice) > 0)) {
      executeSearch({
        dish: searchDish,
        maxPrice,
        city: 'Lucknow',
        area: areaName,
      });
    }
  };

  // Clear search and return to home view
  const handleClearSearch = () => {
    searchRequestIdRef.current += 1;
    setIsSearching(false);
    setSearchDish('');
    setMaxPrice('');
    setSearchResults([]);
    setSearchPagination({ total: 0, has_more: false, next_offset: null });
    setSearchError(null);
    setSearchLoadMoreError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f5] text-stone-900 selection:bg-orange-500 selection:text-white">
      {/* Top Navigation Header */}
      <Header
  key={`header-${searchDish}`}
  selectedCity={selectedCity}
  searchQuery={searchDish}
  onSearchSubmit={(dish) => executeSearch({
    dish,
    maxPrice,
    city: selectedCity,
    area: selectedCity === 'Lucknow' ? selectedLucknowAreaName : '',
  })}
  onClearSearch={handleClearSearch}
/>

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Hero Section */}
        <Hero
          key={`hero-${searchDish}-${maxPrice}-${selectedCity}-${selectedLucknowAreaSlug}`}
          searchQuery={searchDish}
          maxPrice={maxPrice}
          selectedCity={selectedCity}
          onSearch={executeSearch}
          searchRef={heroSearchRef}
        />

        {selectedCity === 'Lucknow' && (
          <LucknowLocationPanel
            areas={lucknowAreas}
            maximumDistanceKm={maximumLucknowDistanceKm}
            selectedAreaSlug={selectedLucknowAreaSlug}
            onAreaChange={handleLucknowAreaChange}
            loadingAreas={lucknowAreasLoading}
            areasError={lucknowAreasError}
          />
        )}

        {/* View Toggle: Search Results vs Homepage View */}
        {isSearching ? (
          <div ref={searchSectionRef}>
            <SearchResults
              searchDish={searchDish}
              results={searchResults}
              loading={searchLoading}
              loadingMore={searchLoadingMore}
              loadMoreError={searchLoadMoreError}
              error={searchError}
              maxPrice={maxPrice}
              selectedCity={selectedCity}
              onUpdateFilters={handleUpdateSearchFilters}
              onClearSearch={handleClearSearch}
              pagination={searchPagination}
              onLoadMore={loadMoreSearchResults}
              selectedAreaSlug={selectedLucknowAreaSlug}
              livePriceCheckEnabled={livePriceCheckEnabled}
              onRetry={() => executeSearch({
                dish: searchDish,
                maxPrice,
                city: selectedCity,
                area: selectedCity === 'Lucknow' ? selectedLucknowAreaName : '',
              })}
            />
          </div>
        ) : (
          <>
            {/* 3. Explore by Cuisine (8 Real MySQL Categories) */}
            <CuisineTiles
              activeKeyword={searchDish}
              onSelectCuisine={handleSelectCuisine}
            />

            {/* 4. Must Grab Deals Grid */}
            <TopPicks
              items={topPicks}
              loading={topPicksLoading}
              error={topPicksError}
              selectedCity={selectedCity}
              selectedAreaSlug={selectedLucknowAreaSlug}
              livePriceCheckEnabled={livePriceCheckEnabled}
              onRetry={reloadTopPicks}
            />
          </>
        )}
      </main>

      {/* 5. Footer */}
      <Footer />
    </div>
  );
}
