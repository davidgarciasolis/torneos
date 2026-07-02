import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Edit3,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Swords,
  Trash2,
  Trophy,
  Users,
  X
} from "lucide-react";
import {
  clearSession,
  createItem,
  deleteItem,
  getDirectusUrl,
  listItems,
  loadSession,
  login,
  logout,
  updateItem
} from "./directus.js";

const EMPTY_FORM = {};
const TOURNAMENT_STATES = ["borrador", "activo", "finalizado", "cancelado"];
const TOURNAMENT_TYPES = ["individual", "equipos"];

const TABS = [
  { id: "resumen", label: "Resumen", icon: Trophy },
  { id: "jugadores", label: "Jugadores", icon: Users },
  { id: "equipos", label: "Equipos", icon: ShieldAlert },
  { id: "jornadas", label: "Jornadas", icon: CalendarDays },
  { id: "puntuaciones", label: "Puntuaciones", icon: Swords },
  { id: "clasificacion", label: "Clasificacion", icon: Trophy }
];

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sortByName(items) {
  return [...items].sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));
}

function collectionError(error) {
  return error?.message || "Ha ocurrido un error inesperado.";
}

export default function App() {
  const [session, setSession] = useState(loadSession());
  const [loginError, setLoginError] = useState("");
  const [busyLogin, setBusyLogin] = useState(false);

  if (!session) {
    return (
      <LoginScreen
        busy={busyLogin}
        error={loginError}
        onSubmit={async (email, password) => {
          setBusyLogin(true);
          setLoginError("");
          try {
            setSession(await login(email, password));
          } catch (error) {
            setLoginError(collectionError(error));
          } finally {
            setBusyLogin(false);
          }
        }}
      />
    );
  }

  return <TournamentApp session={session} setSession={setSession} />;
}

function LoginScreen({ busy, error, onSubmit }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-mark">
          <Swords size={28} />
        </div>
        <h1>Torneos MTG</h1>
        <p>Accede con tu usuario de Directus para gestionar torneos, participantes, jornadas y puntuaciones.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(email, password);
          }}
        >
          <label>
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Contrasena
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? <RefreshCw className="spin" size={18} /> : <Trophy size={18} />}
            Entrar
          </button>
        </form>
        <span className="api-note">API: {getDirectusUrl()}</span>
      </section>
    </main>
  );
}

function TournamentApp({ session, setSession }) {
  const api = useDirectusData(session, setSession);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [selectedTournamentId, setSelectedTournamentId] = useState(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [modal, setModal] = useState(null);

  const selectedTournament = api.torneos.find((torneo) => torneo.id === selectedTournamentId) || api.torneos[0] || null;

  useEffect(() => {
    if (!selectedTournamentId && selectedTournament) setSelectedTournamentId(selectedTournament.id);
    if (selectedTournamentId && !api.torneos.some((torneo) => torneo.id === selectedTournamentId)) {
      setSelectedTournamentId(api.torneos[0]?.id || null);
    }
  }, [api.torneos, selectedTournament, selectedTournamentId]);

  const filteredTournaments = api.torneos.filter((torneo) => {
    const matchesQuery = normalizeName(torneo.nombre).includes(normalizeName(query));
    const matchesState = !stateFilter || torneo.estado === stateFilter;
    return matchesQuery && matchesState;
  });

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <span className="eyebrow">Magic: The Gathering</span>
            <h1>Torneos</h1>
          </div>
          <button className="icon-button" title="Cerrar sesion" onClick={() => logout(session).finally(() => setSession(null))}>
            <LogOut size={18} />
          </button>
        </div>

        <div className="toolbar">
          <label className="search-field">
            <Search size={16} />
            <input placeholder="Buscar torneo" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
            <option value="">Todos</option>
            {TOURNAMENT_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </div>

        <button className="primary-button full" onClick={() => setModal({ type: "torneo", mode: "create", item: null })}>
          <Plus size={18} />
          Nuevo torneo
        </button>

        <div className="tournament-list">
          {filteredTournaments.map((torneo) => (
            <button
              key={torneo.id}
              className={torneo.id === selectedTournament?.id ? "tournament-item active" : "tournament-item"}
              onClick={() => setSelectedTournamentId(torneo.id)}
            >
              <span>{torneo.nombre}</span>
              <small>
                {torneo.estado} · {torneo.tipo}
              </small>
            </button>
          ))}
          {!api.loading && filteredTournaments.length === 0 ? <EmptyState text="No hay torneos con esos filtros." /> : null}
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">Gestion</span>
            <h2>{selectedTournament?.nombre || "Sin torneo seleccionado"}</h2>
          </div>
          <div className="header-actions">
            {api.error ? <span className="inline-error">{api.error}</span> : null}
            <button className="secondary-button" onClick={api.loadAll} disabled={api.loading}>
              <RefreshCw className={api.loading ? "spin" : ""} size={17} />
              Actualizar
            </button>
          </div>
        </header>

        {selectedTournament ? (
          <>
            <nav className="tabs">
              {TABS.filter((tab) => selectedTournament.tipo === "equipos" || tab.id !== "equipos").map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            <TournamentDetail tournament={selectedTournament} activeTab={activeTab} api={api} openModal={setModal} />
          </>
        ) : (
          <EmptyState text="Crea un torneo para empezar." />
        )}
      </section>

      {modal ? <EntityModal modal={modal} close={() => setModal(null)} api={api} tournament={selectedTournament} /> : null}
    </main>
  );
}

function useDirectusData(session, setSession) {
  const [items, setItems] = useState({
    torneos: [],
    equipos: [],
    jugadores: [],
    jornadas: [],
    puntuaciones: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const onSessionChange = (nextSession) => {
    if (!nextSession) clearSession();
    setSession(nextSession);
  };

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [torneos, equipos, jugadores, jornadas, puntuaciones] = await Promise.all([
        listItems("torneos", { limit: -1, sort: ["-date_created"] }, session, onSessionChange),
        listItems("equipos", { limit: -1, sort: ["nombre"] }, session, onSessionChange),
        listItems("jugadores", { limit: -1, sort: ["nombre"] }, session, onSessionChange),
        listItems("jornadas", { limit: -1, sort: ["fecha_jornada", "id"] }, session, onSessionChange),
        listItems("puntuaciones", { limit: -1, sort: ["id_jornada", "id"] }, session, onSessionChange)
      ]);
      setItems({ torneos, equipos, jugadores, jornadas, puntuaciones });
    } catch (loadError) {
      setError(collectionError(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const save = async (collection, data, id) => {
    const saved = id
      ? await updateItem(collection, id, data, session, onSessionChange)
      : await createItem(collection, data, session, onSessionChange);
    await loadAll();
    return saved;
  };

  const remove = async (collection, id) => {
    await deleteItem(collection, id, session, onSessionChange);
    await loadAll();
  };

  return { ...items, loading, error, loadAll, save, remove };
}

function TournamentDetail({ tournament, activeTab, api, openModal }) {
  const scope = useMemo(() => getTournamentScope(tournament.id, api), [tournament.id, api]);

  if (activeTab === "resumen") {
    return <Summary tournament={tournament} scope={scope} openModal={openModal} />;
  }
  if (activeTab === "jugadores") {
    return <PlayersTable tournament={tournament} scope={scope} openModal={openModal} api={api} />;
  }
  if (activeTab === "equipos") {
    return <TeamsTable tournament={tournament} scope={scope} openModal={openModal} api={api} />;
  }
  if (activeTab === "jornadas") {
    return <RoundsTable tournament={tournament} scope={scope} openModal={openModal} api={api} />;
  }
  if (activeTab === "puntuaciones") {
    return <ScoresTable tournament={tournament} scope={scope} openModal={openModal} api={api} />;
  }
  return <Standings tournament={tournament} scope={scope} />;
}

function getTournamentScope(tournamentId, api) {
  return {
    equipos: sortByName(api.equipos.filter((item) => item.id_torneo === tournamentId)),
    jugadores: sortByName(api.jugadores.filter((item) => item.id_torneo === tournamentId)),
    jornadas: [...api.jornadas.filter((item) => item.id_torneo === tournamentId)].sort((a, b) =>
      String(a.fecha_jornada || "").localeCompare(String(b.fecha_jornada || ""))
    ),
    puntuaciones: api.puntuaciones.filter((item) => item.id_torneo === tournamentId)
  };
}

function Summary({ tournament, scope, openModal }) {
  return (
    <section className="content-grid">
      <div className="summary-panel">
        <div className="panel-title">
          <h3>Datos del torneo</h3>
          <button className="secondary-button" onClick={() => openModal({ type: "torneo", mode: "edit", item: tournament })}>
            <Edit3 size={16} />
            Editar
          </button>
        </div>
        <dl className="facts">
          <div>
            <dt>Estado</dt>
            <dd>{tournament.estado}</dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{tournament.tipo}</dd>
          </div>
          <div>
            <dt>Jugadores</dt>
            <dd>{scope.jugadores.length}</dd>
          </div>
          <div>
            <dt>Equipos</dt>
            <dd>{scope.equipos.length}</dd>
          </div>
          <div>
            <dt>Jornadas</dt>
            <dd>{scope.jornadas.length}</dd>
          </div>
          <div>
            <dt>Puntuaciones</dt>
            <dd>{scope.puntuaciones.length}</dd>
          </div>
        </dl>
      </div>

      <div className="summary-panel">
        <div className="panel-title">
          <h3>Acciones rapidas</h3>
        </div>
        <div className="quick-actions">
          <button onClick={() => openModal({ type: "jugador", mode: "create", item: null })}>
            <Plus size={17} />
            Jugador
          </button>
          {tournament.tipo === "equipos" ? (
            <button onClick={() => openModal({ type: "equipo", mode: "create", item: null })}>
              <Plus size={17} />
              Equipo
            </button>
          ) : null}
          <button onClick={() => openModal({ type: "jornada", mode: "create", item: null })}>
            <Plus size={17} />
            Jornada
          </button>
          <button onClick={() => openModal({ type: "puntuacion", mode: "create", item: null })}>
            <Plus size={17} />
            Puntuacion
          </button>
        </div>
      </div>
    </section>
  );
}

function PlayersTable({ tournament, scope, openModal, api }) {
  return (
    <DataPanel
      title="Jugadores"
      actionLabel="Nuevo jugador"
      onCreate={() => openModal({ type: "jugador", mode: "create", item: null })}
      empty="Aun no hay jugadores."
    >
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            {tournament.tipo === "equipos" ? <th>Equipo</th> : null}
            <th className="actions-cell">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {scope.jugadores.map((jugador) => (
            <tr key={jugador.id}>
              <td>{jugador.nombre}</td>
              {tournament.tipo === "equipos" ? <td>{scope.equipos.find((equipo) => equipo.id === jugador.id_equipo)?.nombre || "Sin equipo"}</td> : null}
              <RowActions
                onEdit={() => openModal({ type: "jugador", mode: "edit", item: jugador })}
                onDelete={() => confirmDelete(api, "jugadores", jugador.id, jugador.nombre)}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </DataPanel>
  );
}

function TeamsTable({ scope, openModal, api }) {
  return (
    <DataPanel title="Equipos" actionLabel="Nuevo equipo" onCreate={() => openModal({ type: "equipo", mode: "create", item: null })} empty="Aun no hay equipos.">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Jugadores</th>
            <th className="actions-cell">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {scope.equipos.map((equipo) => (
            <tr key={equipo.id}>
              <td>{equipo.nombre}</td>
              <td>{scope.jugadores.filter((jugador) => jugador.id_equipo === equipo.id).length}</td>
              <RowActions
                onEdit={() => openModal({ type: "equipo", mode: "edit", item: equipo })}
                onDelete={() => confirmDelete(api, "equipos", equipo.id, equipo.nombre)}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </DataPanel>
  );
}

function RoundsTable({ scope, openModal, api }) {
  return (
    <DataPanel title="Jornadas" actionLabel="Nueva jornada" onCreate={() => openModal({ type: "jornada", mode: "create", item: null })} empty="Aun no hay jornadas.">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Fecha</th>
            <th>Puntuaciones</th>
            <th className="actions-cell">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {scope.jornadas.map((jornada) => (
            <tr key={jornada.id}>
              <td>{jornada.nombre || `Jornada ${jornada.id}`}</td>
              <td>{jornada.fecha_jornada}</td>
              <td>{scope.puntuaciones.filter((puntuacion) => puntuacion.id_jornada === jornada.id).length}</td>
              <RowActions
                onEdit={() => openModal({ type: "jornada", mode: "edit", item: jornada })}
                onDelete={() => confirmDelete(api, "jornadas", jornada.id, jornada.nombre || `Jornada ${jornada.id}`)}
              />
            </tr>
          ))}
        </tbody>
      </table>
    </DataPanel>
  );
}

function ScoresTable({ tournament, scope, openModal, api }) {
  const participantLabel = tournament.tipo === "equipos" ? "Equipo" : "Jugador";

  return (
    <DataPanel
      title="Puntuaciones"
      actionLabel="Nueva puntuacion"
      onCreate={() => openModal({ type: "puntuacion", mode: "create", item: null })}
      empty="Aun no hay puntuaciones."
    >
      <table>
        <thead>
          <tr>
            <th>Jornada</th>
            <th>{participantLabel}</th>
            <th>Puntos</th>
            <th>Notas</th>
            <th className="actions-cell">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {scope.puntuaciones.map((puntuacion) => {
            const jornada = scope.jornadas.find((item) => item.id === puntuacion.id_jornada);
            const participante =
              tournament.tipo === "equipos"
                ? scope.equipos.find((item) => item.id === puntuacion.id_equipo)
                : scope.jugadores.find((item) => item.id === puntuacion.id_jugador);
            return (
              <tr key={puntuacion.id}>
                <td>{jornada?.nombre || jornada?.fecha_jornada || "Sin jornada"}</td>
                <td>{participante?.nombre || "Sin participante"}</td>
                <td>{Number(puntuacion.puntuacion || 0).toFixed(2)}</td>
                <td>{puntuacion.notas || ""}</td>
                <RowActions
                  onEdit={() => openModal({ type: "puntuacion", mode: "edit", item: puntuacion })}
                  onDelete={() => confirmDelete(api, "puntuaciones", puntuacion.id, "esta puntuacion")}
                />
              </tr>
            );
          })}
        </tbody>
      </table>
    </DataPanel>
  );
}

function Standings({ tournament, scope }) {
  const rows = useMemo(() => {
    const participants = tournament.tipo === "equipos" ? scope.equipos : scope.jugadores;
    const idKey = tournament.tipo === "equipos" ? "id_equipo" : "id_jugador";

    return participants
      .map((participant) => {
        const scores = scope.puntuaciones.filter((score) => score[idKey] === participant.id);
        const total = scores.reduce((sum, score) => sum + Number(score.puntuacion || 0), 0);
        return { ...participant, total, rounds: scores.length };
      })
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es"));
  }, [scope, tournament.tipo]);

  return (
    <DataPanel title="Clasificacion" empty="Aun no hay participantes.">
      <table>
        <thead>
          <tr>
            <th>Posicion</th>
            <th>{tournament.tipo === "equipos" ? "Equipo" : "Jugador"}</th>
            <th>Puntos</th>
            <th>Jornadas puntuadas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td>{index + 1}</td>
              <td>{row.nombre}</td>
              <td>{row.total.toFixed(2)}</td>
              <td>{row.rounds}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataPanel>
  );
}

function DataPanel({ title, actionLabel, onCreate, empty, children }) {
  const hasRows = children?.props?.children?.[1]?.props?.children?.length !== 0;

  return (
    <section className="data-panel">
      <div className="panel-title">
        <h3>{title}</h3>
        {actionLabel ? (
          <button className="primary-button compact" onClick={onCreate}>
            <Plus size={16} />
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="table-wrap">{hasRows ? children : <EmptyState text={empty} />}</div>
    </section>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <td className="row-actions">
      <button className="icon-button" title="Editar" onClick={onEdit}>
        <Edit3 size={16} />
      </button>
      <button className="icon-button danger" title="Borrar" onClick={onDelete}>
        <Trash2 size={16} />
      </button>
    </td>
  );
}

async function confirmDelete(api, collection, id, label) {
  if (window.confirm(`Borrar ${label}? Esta accion no se puede deshacer.`)) {
    await api.remove(collection, id).catch((error) => alert(collectionError(error)));
  }
}

function EntityModal({ modal, close, api, tournament }) {
  const [form, setForm] = useState(() => initialForm(modal, tournament));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const scope = tournament ? getTournamentScope(tournament.id, api) : { equipos: [], jugadores: [], jornadas: [], puntuaciones: [] };
  const title = `${modal.mode === "create" ? "Crear" : "Editar"} ${entityLabel(modal.type)}`;

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    const validation = validateEntity(modal, form, tournament, scope);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    try {
      await api.save(collectionFor(modal.type), payloadFor(modal.type, form, tournament), modal.item?.id);
      close();
    } catch (saveError) {
      setError(collectionError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h3 id="modal-title">{title}</h3>
          <button className="icon-button" title="Cerrar" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="entity-form">
          <EntityFields type={modal.type} form={form} update={update} tournament={tournament} scope={scope} />
          {error ? <div className="form-error">{error}</div> : null}
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={close}>
              Cancelar
            </button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? <RefreshCw className="spin" size={17} /> : <Save size={17} />}
              Guardar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EntityFields({ type, form, update, tournament, scope }) {
  if (type === "torneo") {
    return (
      <>
        <label>
          Nombre
          <input required maxLength={150} value={form.nombre || ""} onChange={(event) => update("nombre", event.target.value)} />
        </label>
        <label>
          Estado
          <select required value={form.estado || "borrador"} onChange={(event) => update("estado", event.target.value)}>
            {TOURNAMENT_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select required value={form.tipo || "individual"} onChange={(event) => update("tipo", event.target.value)}>
            {TOURNAMENT_TYPES.map((typeOption) => (
              <option key={typeOption} value={typeOption}>
                {typeOption}
              </option>
            ))}
          </select>
        </label>
      </>
    );
  }

  if (type === "equipo") {
    return (
      <label>
        Nombre
        <input required maxLength={150} value={form.nombre || ""} onChange={(event) => update("nombre", event.target.value)} />
      </label>
    );
  }

  if (type === "jugador") {
    return (
      <>
        <label>
          Nombre
          <input required maxLength={150} value={form.nombre || ""} onChange={(event) => update("nombre", event.target.value)} />
        </label>
        {tournament?.tipo === "equipos" ? (
          <label>
            Equipo
            <select value={form.id_equipo || ""} onChange={(event) => update("id_equipo", numberOrNull(event.target.value))}>
              <option value="">Sin equipo</option>
              {scope.equipos.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </>
    );
  }

  if (type === "jornada") {
    return (
      <>
        <label>
          Nombre
          <input maxLength={100} value={form.nombre || ""} onChange={(event) => update("nombre", event.target.value)} placeholder="Ronda 1" />
        </label>
        <label>
          Fecha
          <input required type="date" value={form.fecha_jornada || today()} onChange={(event) => update("fecha_jornada", event.target.value)} />
        </label>
      </>
    );
  }

  const participants = tournament?.tipo === "equipos" ? scope.equipos : scope.jugadores;
  const participantKey = tournament?.tipo === "equipos" ? "id_equipo" : "id_jugador";

  return (
    <>
      <label>
        Jornada
        <select required value={form.id_jornada || ""} onChange={(event) => update("id_jornada", Number(event.target.value))}>
          <option value="">Selecciona una jornada</option>
          {scope.jornadas.map((jornada) => (
            <option key={jornada.id} value={jornada.id}>
              {jornada.nombre || jornada.fecha_jornada}
            </option>
          ))}
        </select>
      </label>
      <label>
        {tournament?.tipo === "equipos" ? "Equipo" : "Jugador"}
        <select required value={form[participantKey] || ""} onChange={(event) => update(participantKey, Number(event.target.value))}>
          <option value="">Selecciona</option>
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {participant.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Puntos
        <input required type="number" step="0.01" value={form.puntuacion ?? 0} onChange={(event) => update("puntuacion", event.target.value)} />
      </label>
      <label>
        Notas
        <textarea value={form.notas || ""} onChange={(event) => update("notas", event.target.value)} rows={3} />
      </label>
    </>
  );
}

function initialForm(modal, tournament) {
  if (modal.item) return { ...modal.item };
  if (modal.type === "torneo") return { nombre: "", estado: "borrador", tipo: "individual" };
  if (modal.type === "jornada") return { nombre: "", fecha_jornada: today(), id_torneo: tournament?.id };
  if (modal.type === "puntuacion") return { id_torneo: tournament?.id, id_jornada: "", puntuacion: 0, notas: "" };
  if (modal.type === "jugador") return { nombre: "", id_torneo: tournament?.id, id_equipo: null };
  if (modal.type === "equipo") return { nombre: "", id_torneo: tournament?.id };
  return EMPTY_FORM;
}

function entityLabel(type) {
  return {
    torneo: "torneo",
    equipo: "equipo",
    jugador: "jugador",
    jornada: "jornada",
    puntuacion: "puntuacion"
  }[type];
}

function collectionFor(type) {
  return {
    torneo: "torneos",
    equipo: "equipos",
    jugador: "jugadores",
    jornada: "jornadas",
    puntuacion: "puntuaciones"
  }[type];
}

function payloadFor(type, form, tournament) {
  if (type === "torneo") {
    return { nombre: form.nombre.trim(), estado: form.estado, tipo: form.tipo };
  }
  if (type === "equipo") {
    return { nombre: form.nombre.trim(), id_torneo: tournament.id };
  }
  if (type === "jugador") {
    return { nombre: form.nombre.trim(), id_torneo: tournament.id, id_equipo: tournament.tipo === "equipos" ? form.id_equipo || null : null };
  }
  if (type === "jornada") {
    return { nombre: form.nombre?.trim() || null, fecha_jornada: form.fecha_jornada, id_torneo: tournament.id };
  }

  const isTeams = tournament.tipo === "equipos";
  return {
    id_torneo: tournament.id,
    id_jornada: Number(form.id_jornada),
    id_equipo: isTeams ? Number(form.id_equipo) : null,
    id_jugador: isTeams ? null : Number(form.id_jugador),
    puntuacion: Number(form.puntuacion || 0),
    notas: form.notas?.trim() || null
  };
}

function validateEntity(modal, form, tournament, scope) {
  if (modal.type === "torneo") {
    if (!form.nombre?.trim()) return "El nombre es obligatorio.";
    return "";
  }

  if (!tournament) return "Selecciona un torneo.";

  if (modal.type === "equipo") {
    if (!form.nombre?.trim()) return "El nombre es obligatorio.";
    const duplicate = scope.equipos.some((equipo) => equipo.id !== modal.item?.id && normalizeName(equipo.nombre) === normalizeName(form.nombre));
    return duplicate ? "Ya existe un equipo con ese nombre en este torneo." : "";
  }

  if (modal.type === "jugador") {
    if (!form.nombre?.trim()) return "El nombre es obligatorio.";
    const duplicate = scope.jugadores.some((jugador) => jugador.id !== modal.item?.id && normalizeName(jugador.nombre) === normalizeName(form.nombre));
    if (duplicate) return "Ya existe un jugador con ese nombre en este torneo.";
    if (form.id_equipo && !scope.equipos.some((equipo) => equipo.id === Number(form.id_equipo))) return "El equipo elegido no pertenece a este torneo.";
    return "";
  }

  if (modal.type === "jornada") {
    if (!form.fecha_jornada) return "La fecha es obligatoria.";
    return "";
  }

  if (!form.id_jornada || !scope.jornadas.some((jornada) => jornada.id === Number(form.id_jornada))) {
    return "La jornada elegida no pertenece a este torneo.";
  }

  const key = tournament.tipo === "equipos" ? "id_equipo" : "id_jugador";
  const list = tournament.tipo === "equipos" ? scope.equipos : scope.jugadores;
  if (!form[key] || !list.some((item) => item.id === Number(form[key]))) {
    return tournament.tipo === "equipos" ? "Selecciona un equipo del torneo." : "Selecciona un jugador del torneo.";
  }

  const duplicate = scope.puntuaciones.some(
    (puntuacion) => puntuacion.id !== modal.item?.id && puntuacion.id_jornada === Number(form.id_jornada) && puntuacion[key] === Number(form[key])
  );
  return duplicate ? "Ya existe una puntuacion para ese participante en esa jornada." : "";
}

function numberOrNull(value) {
  return value ? Number(value) : null;
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}
