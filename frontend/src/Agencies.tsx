import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { ArrowUpRight, Clock3, MapPin, Phone } from "lucide-react";
import type { Location } from "./lib";
import { Button } from "./components/ui/button";
export function Agencies({
  locations,
  onChoose,
}: {
  locations: Location[];
  onChoose: (city: string) => void;
}) {
  return (
    <section className="section-container page-section">
      <div className="eyebrow">TOUJOURS UN BON POINT DE DÉPART</div>
      <div className="section-heading">
        <div>
          <h1>Retrouvons-nous en agence.</h1>
          <p>Quatre villes, une même envie de vous faire prendre la route.</p>
        </div>
        <span className="agency-count">
          <MapPin size={18} />
          {locations.length} agences au Maroc
        </span>
      </div>
      <div className="agencies-layout">
        <div className="agency-cards">
          {locations.length === 0 ? (
            <div className="empty-state">
              <MapPin />
              <p>
                Les agences sont en cours de chargement. Vérifiez que l’API est
                démarrée.
              </p>
            </div>
          ) : (
            locations.map((l, i) => (
              <article className="agency-card" key={l.id}>
                <span className="agency-number">0{i + 1}</span>
                <div>
                  <span className="eyebrow">{l.city}</span>
                  <h3>{l.name}</h3>
                  <p>{l.address}</p>
                  <div className="agency-contact">
                    <span>
                      <Phone size={13} />
                      {l.phone}
                    </span>
                    <span>
                      <Clock3 size={13} /> L’accueil vous accompagne
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onChoose(l.city)}
                  >
                    Voir les voitures <ArrowUpRight size={16} />
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
        <div className="agency-map">
          <MapContainer
            center={[32.1, -7.5]}
            zoom={6}
            scrollWheelZoom={false}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {locations.map((l) => (
              <CircleMarker
                key={l.id}
                center={[l.latitude, l.longitude]}
                radius={10}
                pathOptions={{
                  color: "#173e31",
                  fillColor: "#c8eb76",
                  fillOpacity: 1,
                  weight: 4,
                }}
              >
                <Popup>
                  <strong>{l.name}</strong>
                  <br />
                  {l.address}
                  <br />
                  {l.phone}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          <div className="map-note">
            <span /> Le Maroc, à portée de volant.
          </div>
        </div>
      </div>
    </section>
  );
}
