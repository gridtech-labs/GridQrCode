import { create } from "zustand";
import api from "../lib/api";
import type {
  Area, Table, TableStatus,
  CreateAreaDto, UpdateAreaDto,
  CreateTableDto, UpdateTableDto,
} from "@qr-saas/shared";

interface TableState {
  areas: Area[];
  tables: Table[];
  isLoading: boolean;
  error: string | null;

  fetchAreas: () => Promise<void>;
  createArea: (dto: CreateAreaDto) => Promise<Area>;
  updateArea: (id: string, dto: UpdateAreaDto) => Promise<void>;
  deleteArea: (id: string) => Promise<void>;

  fetchTables: (areaId?: string) => Promise<void>;
  createTable: (dto: CreateTableDto) => Promise<Table>;
  updateTable: (id: string, dto: UpdateTableDto) => Promise<void>;
  updateStatus: (id: string, status: TableStatus) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
}

export const useTableStore = create<TableState>((set) => ({
  areas: [],
  tables: [],
  isLoading: false,
  error: null,

  fetchAreas: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get<{ data: { areas: Area[] } }>("/tables/areas");
      set({ areas: data.data.areas, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  createArea: async (dto) => {
    const { data } = await api.post<{ data: { area: Area } }>("/tables/areas", dto);
    set((s) => ({ areas: [...s.areas, data.data.area] }));
    return data.data.area;
  },

  updateArea: async (id, dto) => {
    const { data } = await api.patch<{ data: { area: Area } }>(`/tables/areas/${id}`, dto);
    set((s) => ({ areas: s.areas.map((a) => (a.id === id ? data.data.area : a)) }));
  },

  deleteArea: async (id) => {
    await api.delete(`/tables/areas/${id}`);
    set((s) => ({ areas: s.areas.filter((a) => a.id !== id) }));
  },

  fetchTables: async (areaId) => {
    set({ isLoading: true });
    try {
      const params = areaId ? `?areaId=${areaId}` : "";
      const { data } = await api.get<{ data: { tables: Table[] } }>(`/tables${params}`);
      set({ tables: data.data.tables, isLoading: false });
    } catch { set({ isLoading: false }); }
  },

  createTable: async (dto) => {
    const { data } = await api.post<{ data: { table: Table } }>("/tables", dto);
    set((s) => ({ tables: [...s.tables, data.data.table] }));
    return data.data.table;
  },

  updateTable: async (id, dto) => {
    const { data } = await api.patch<{ data: { table: Table } }>(`/tables/${id}`, dto);
    set((s) => ({ tables: s.tables.map((t) => (t.id === id ? data.data.table : t)) }));
  },

  updateStatus: async (id, status) => {
    const { data } = await api.patch<{ data: { table: Table } }>(`/tables/${id}/status`, { status });
    set((s) => ({ tables: s.tables.map((t) => (t.id === id ? data.data.table : t)) }));
  },

  deleteTable: async (id) => {
    await api.delete(`/tables/${id}`);
    set((s) => ({ tables: s.tables.filter((t) => t.id !== id) }));
  },
}));
