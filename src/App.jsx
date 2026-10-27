import { useEffect, useRef, useState } from "react";
import {
  Search,
  MapPin,
  Thermometer,
  Droplets,
  Wind,
  Eye,
  CloudSun,
  LoaderCircle,
  AlertCircle,
  RefreshCw,
  Clock3,
  Globe2,
  X,
  History,
  Trash2,
} from "lucide-react";

const API_URL = "http://127.0.0.1:5000/api/weather";
const ACTIVE_SEARCH_KEY = "weathernow:active-search";
const RECENT_SEARCHES_KEY = "weathernow:recent-searches";
const MAX_RECENT_SEARCHES = 10;

// Safely read saved data from localStorage.
function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Unable to save data to localStorage:", error);
  }
}

function removeStorage(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Unable to clear localStorage:", error);
  }
}

function App() {
  // Restore the previous successful search when the app opens.
  const [initialSearch] = useState(() => readStorage(ACTIVE_SEARCH_KEY, null));

  const [city, setCity] = useState(() => initialSearch?.city || "");

  const [weather, setWeather] = useState(() => initialSearch?.weather || null);

  const [recentSearches, setRecentSearches] = useState(() =>
    readStorage(RECENT_SEARCHES_KEY, []),
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localClock, setLocalClock] = useState("");
  const [localDate, setLocalDate] = useState("");

  const requestController = useRef(null);

  // Persist recent searches whenever the history changes.
  useEffect(() => {
    saveStorage(RECENT_SEARCHES_KEY, recentSearches);
  }, [recentSearches]);

  // Update local time for the selected location.
  useEffect(() => {
    if (!weather?.timezone) {
      setLocalClock("");
      setLocalDate("");
      return;
    }

    const updateClock = () => {
      try {
        const now = new Date();

        setLocalClock(
          new Intl.DateTimeFormat("en-US", {
            timeZone: weather.timezone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          }).format(now),
        );

        setLocalDate(
          new Intl.DateTimeFormat("en-US", {
            timeZone: weather.timezone,
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(now),
        );
      } catch {
        setLocalClock("Unavailable");
        setLocalDate("");
      }
    };

    updateClock();

    const timer = setInterval(updateClock, 1000);

    return () => clearInterval(timer);
  }, [weather?.timezone]);

  // Save the active result for restoring it after a refresh.
  const saveActiveSearch = (searchCity, weatherData) => {
    saveStorage(ACTIVE_SEARCH_KEY, {
      city: searchCity,
      weather: weatherData,
    });
  };

  // Add a successful search to the recent history.
  const addToRecentSearches = (searchCity, weatherData) => {
    setRecentSearches((previous) => {
      const normalizedCity = searchCity.trim().toLowerCase();

      const updated = [
        {
          city: searchCity,
          weather: weatherData,
          searchedAt: Date.now(),
        },
        ...previous.filter(
          (item) => item.city.trim().toLowerCase() !== normalizedCity,
        ),
      ].slice(0, MAX_RECENT_SEARCHES);

      saveStorage(RECENT_SEARCHES_KEY, updated);

      return updated;
    });
  };

  // Clear the active result and return to the home screen.
  // Recent searches remain saved.
  const clearActiveSearch = () => {
    requestController.current?.abort();
    requestController.current = null;

    setCity("");
    setWeather(null);
    setError("");
    setLoading(false);

    removeStorage(ACTIVE_SEARCH_KEY);
  };

  // Handle typing, backspace, and deleting the whole input.
  const handleCityChange = (event) => {
    const value = event.target.value;

    setCity(value);
    setError("");

    if (!value.trim()) {
      clearActiveSearch();
    }
  };

  // Search for weather from the Python Flask API.
  const searchWeather = async (event) => {
    event?.preventDefault();

    const cityName = city.trim();

    if (!cityName) {
      clearActiveSearch();
      return;
    }

    requestController.current?.abort();

    const controller = new AbortController();
    requestController.current = controller;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}?city=${encodeURIComponent(cityName)}`,
        { signal: controller.signal },
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Unable to get weather data.",
        );
      }

      if (data.temperature == null || !data.timezone) {
        throw new Error("The weather API returned incomplete data.");
      }

      // Ignore a result if the user has started another request.
      if (requestController.current !== controller) {
        return;
      }

      setWeather(data);

      saveActiveSearch(cityName, data);
      addToRecentSearches(cityName, data);
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }

      if (requestController.current !== controller) {
        return;
      }

      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the Python server. Make sure server.py is running on port 5000."
          : err.message || "Something went wrong. Please try again.",
      );
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setLoading(false);
      }
    }
  };

  // Open a previously searched location.
  const openRecentSearch = (item) => {
    requestController.current?.abort();
    requestController.current = null;

    setCity(item.city);
    setWeather(item.weather);
    setError("");
    setLoading(false);

    saveActiveSearch(item.city, item.weather);
  };

  // Remove one location from recent searches.
  const removeRecentSearch = (event, cityName) => {
    event.stopPropagation();

    setRecentSearches((previous) =>
      previous.filter(
        (item) =>
          item.city.trim().toLowerCase() !== cityName.trim().toLowerCase(),
      ),
    );
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    removeStorage(RECENT_SEARCHES_KEY);
  };

  const vibe = getWeatherVibe(weather?.vibe);

  return (
    <div className="weather-app min-h-screen bg-slate-950 text-white">
      {/* Full-screen animated background follows current weather. */}
      <div className={`weather-background ${vibe}`} aria-hidden="true">
        <div className="weather-sky" />
        <div className="weather-clouds weather-clouds-back" />
        <div className="weather-clouds weather-clouds-front" />
        <div className="weather-rain" />
        <div className="weather-snow" />
        <div className="weather-lightning" />
        <div className="weather-vignette" />
      </div>

      <main className="relative z-10">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
          {/* Header */}
          <header className="mb-10 text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/25 px-4 py-2 text-sm text-sky-100 shadow-lg backdrop-blur-md">
              <CloudSun size={18} />
              Live Weather Experience
            </div>

            <h1 className="text-4xl font-bold tracking-tight drop-shadow-lg sm:text-6xl">
              Weather<span className="text-sky-300">Now</span>
            </h1>

            <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-white/75 sm:text-base">
              Discover real-time weather and local time for cities around the
              world.
            </p>
          </header>

          {/* Search box with clear button */}
          <form
            onSubmit={searchWeather}
            className="mx-auto mb-6 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/20 bg-slate-950/35 p-3 shadow-2xl backdrop-blur-xl sm:flex-row"
          >
            <div className="relative flex-1">
              <MapPin
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50"
              />

              <input
                type="text"
                value={city}
                onChange={handleCityChange}
                placeholder="Search city or district, e.g. Khulna"
                aria-label="City or district name"
                autoComplete="off"
                className="input input-bordered h-12 w-full border-white/15 bg-slate-950/45 pl-11 pr-12 text-white placeholder:text-white/45 focus:border-sky-300 focus:outline-none"
              />

              {city.length > 0 && (
                <button
                  type="button"
                  onClick={clearActiveSearch}
                  aria-label="Clear search"
                  title="Clear search"
                  className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={19} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !city.trim()}
              className="btn h-12 border-0 bg-sky-500 px-6 text-white hover:bg-sky-400 disabled:opacity-60"
            >
              {loading ? (
                <LoaderCircle size={20} className="animate-spin" />
              ) : (
                <Search size={20} />
              )}
              {loading ? "Searching..." : "Search"}
            </button>
          </form>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="alert alert-error mx-auto mb-6 max-w-2xl items-start border border-white/10 shadow-xl"
            >
              <AlertCircle size={20} className="mt-0.5 shrink-0" />

              <div className="min-w-0">
                <p className="font-semibold">Unable to load weather</p>
                <p className="mt-1 break-words text-sm">{error}</p>

                <button
                  type="button"
                  onClick={() => searchWeather()}
                  disabled={loading || !city.trim()}
                  className="btn btn-sm mt-3 border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  <RefreshCw size={14} />
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Home screen: shown whenever there is no active result. */}
          {!weather && !loading && (
            <section>
              <div className="rounded-3xl border border-white/20 bg-slate-950/30 px-6 py-12 text-center shadow-2xl backdrop-blur-lg sm:py-16">
                <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-sky-200">
                  <CloudSun size={48} strokeWidth={1.3} />
                </div>

                <h2 className="text-xl font-semibold">
                  Find your local weather
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/70">
                  Search for a city or district to see its current weather,
                  local time and atmospheric conditions.
                </p>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {["Dhaka", "Khulna", "Bagerhat", "London", "Tokyo"].map(
                    (place) => (
                      <button
                        key={place}
                        type="button"
                        onClick={() => setCity(place)}
                        className="rounded-full border border-white/20 bg-slate-950/25 px-4 py-2 text-sm text-white/85 transition hover:border-sky-300/60 hover:bg-sky-400/20"
                      >
                        {place}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Recent search history */}
              {recentSearches.length > 0 && (
                <div className="mt-7 rounded-3xl border border-white/15 bg-slate-950/30 p-5 shadow-xl backdrop-blur-lg sm:p-6">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-lg font-semibold">
                        <History size={19} className="text-sky-300" />
                        Recent Searches
                      </h3>
                      <p className="mt-1 text-xs text-white/55">
                        Your last {recentSearches.length} searched{" "}
                        {recentSearches.length === 1 ? "location" : "locations"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs text-white/65 transition hover:border-red-300/40 hover:bg-red-400/10 hover:text-red-200"
                    >
                      <Trash2 size={14} />
                      Clear history
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {recentSearches.map((item) => (
                      <div
                        key={`${item.city}-${item.searchedAt}`}
                        className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition hover:border-sky-300/40 hover:bg-white/[0.08]"
                      >
                        <button
                          type="button"
                          onClick={() => openRecentSearch(item)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-200">
                            {getWeatherIcon(item.weather?.vibe, 23)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-white">
                              {item.city}
                            </p>
                            <p className="mt-1 truncate text-xs text-white/55">
                              {item.weather?.description ||
                                "Weather result saved"}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-lg font-semibold">
                              {item.weather?.temperature != null
                                ? `${item.weather.temperature}°`
                                : "--"}
                            </p>
                            <p className="text-[10px] text-white/50">Celsius</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={(event) =>
                            removeRecentSearch(event, item.city)
                          }
                          aria-label={`Remove ${item.city} from history`}
                          title="Remove from history"
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Loading */}
          {loading && (
            <div className="rounded-3xl border border-white/20 bg-slate-950/35 py-16 text-center shadow-2xl backdrop-blur-lg">
              <LoaderCircle
                className="mx-auto mb-5 animate-spin text-sky-300"
                size={42}
              />
              <h2 className="font-medium text-white">
                Fetching weather information
              </h2>
              <p className="mt-2 text-sm text-white/70">
                Checking current conditions for {city.trim()}...
              </p>
            </div>
          )}

          {/* Active weather result */}
          {weather && !loading && (
            <section aria-live="polite">
              <div className="rounded-3xl border border-white/20 bg-slate-950/30 p-6 shadow-2xl backdrop-blur-lg sm:p-10">
                <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sky-100">
                      <MapPin size={18} />
                      <span className="text-sm font-medium">
                        Current weather
                      </span>
                    </div>

                    <h2 className="mt-3 break-words text-3xl font-bold drop-shadow sm:text-4xl">
                      {weather.city}
                    </h2>

                    <p className="mt-1 flex items-center gap-2 text-sm text-white/75">
                      <Globe2 size={15} />
                      {weather.country}
                    </p>

                    <div className="mt-6">
                      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-sky-100">
                        <Clock3 size={15} />
                        Local time
                      </p>

                      <p className="mt-2 text-2xl font-semibold tabular-nums sm:text-3xl">
                        {localClock || "--:--:--"}
                      </p>

                      <p className="mt-1 text-sm text-white/75">{localDate}</p>

                      <p className="mt-2 break-all text-xs text-white/55">
                        {weather.timezone}
                      </p>
                    </div>

                    <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/20 px-4 py-2 backdrop-blur-md">
                      {getWeatherIcon(weather.vibe)}
                      <span className="text-sm text-white">
                        {weather.description}
                      </span>
                    </div>

                    <p className="mt-4 text-sm text-white/75">
                      Feels like {weather.feelsLike}°C
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3 sm:gap-4">
                    <div className="text-sky-100 drop-shadow-lg">
                      {getWeatherIcon(weather.vibe, 76)}
                    </div>

                    <div>
                      <div className="text-6xl font-light tracking-tighter drop-shadow-lg sm:text-7xl">
                        {weather.temperature}°
                      </div>
                      <p className="mt-2 text-center text-sm text-white/75">
                        Celsius
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weather details */}
              <div className="mb-4 mt-8 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold drop-shadow">
                    Weather details
                  </h3>
                  <p className="mt-1 text-sm text-white/65">
                    Current atmospheric conditions
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => searchWeather()}
                  disabled={loading}
                  className="btn btn-ghost btn-sm border border-white/15 bg-slate-950/20 text-sky-100 hover:bg-white/10"
                  title="Refresh weather"
                  aria-label="Refresh weather"
                >
                  <RefreshCw size={17} />
                  Refresh
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <WeatherCard
                  icon={<Thermometer size={21} />}
                  label="Feels Like"
                  value={`${weather.feelsLike}°C`}
                  description="Perceived temperature"
                />

                <WeatherCard
                  icon={<Droplets size={21} />}
                  label="Humidity"
                  value={`${weather.humidity}%`}
                  description="Moisture in the air"
                />

                <WeatherCard
                  icon={<Wind size={21} />}
                  label="Wind Speed"
                  value={`${weather.windSpeed} km/h`}
                  description="Current wind speed"
                />

                <WeatherCard
                  icon={<Eye size={21} />}
                  label="Visibility"
                  value={`${weather.visibility} km`}
                  description="Estimated visibility"
                />
              </div>

              <p className="mt-5 text-center text-xs text-white/55">
                Location: {weather.latitude}, {weather.longitude}
              </p>
            </section>
          )}

          {/* Footer */}
          <footer className="mt-12 border-t border-white/15 pt-6 text-center text-sm text-white/65">
            <p>
              WeatherNow <span className="mx-1 text-white/40">•</span>
              Weather data powered by wttr.in
            </p>
            <p className="mt-2 text-xs text-white/50">
              Local time is calculated using the searched location's timezone.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

function getWeatherVibe(vibe) {
  const supportedVibes = ["sunny", "cloud", "rain", "storm", "fog", "snow"];

  return supportedVibes.includes(vibe) ? vibe : "default";
}

function getWeatherIcon(vibe, size = 20) {
  const iconProps = { size, strokeWidth: 1.5 };

  switch (vibe) {
    case "rain":
      return <Droplets {...iconProps} className="text-sky-200" />;

    case "storm":
      return <Wind {...iconProps} className="text-indigo-100" />;

    case "snow":
      return <CloudSun {...iconProps} className="text-blue-100" />;

    case "fog":
    case "cloud":
      return <CloudSun {...iconProps} className="text-slate-100" />;

    default:
      return <CloudSun {...iconProps} className="text-amber-200" />;
  }
}

function WeatherCard({ icon, label, value, description }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-slate-950/35 p-5 shadow-xl backdrop-blur-lg transition duration-300 hover:-translate-y-1 hover:border-sky-200/40 hover:bg-slate-950/45">
      <div className="mb-5 flex items-center gap-3 text-sky-200">
        {icon}
        <span className="text-sm text-white/80">{label}</span>
      </div>

      <p className="text-2xl font-semibold tracking-tight">{value}</p>

      <p className="mt-2 text-xs text-white/55">{description}</p>
    </div>
  );
}

export default App;
