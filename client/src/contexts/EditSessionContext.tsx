import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Types for edit session management
export interface PendingChange {
  entryId: string | number;
  fieldName: string;
  value: any;
  originalValue: any;
}

export interface EditSessionState {
  activeMasterId: string | null;
  isEditing: boolean;
  isDirty: boolean;
  pendingChanges: Map<string | number, Record<string, any>>;
  baseline: Map<string | number, Record<string, any>>;
  saving: boolean;
  pendingTarget: string | null;
}

export interface EditSessionAPI {
  // Edit session control
  startEdit: (masterId: string, baselineData: Record<string, any>[]) => void;
  stopEdit: () => void;
  
  // Dirty state management
  markDirty: (entryId: string | number, fieldName: string, value: any) => void;
  resetDirty: () => void;
  
  // Navigation management
  setPendingTarget: (target: string | null) => void;
  resolvePendingNavigation: (action: 'save' | 'discard' | 'cancel') => Promise<void>;
  
  // Save/discard operations
  commitSave: () => Promise<void>;
  discardChanges: () => void;
  
  // State getters and helpers
  hasUnsavedChanges: () => boolean;
  isEditingMaster: (masterId: string) => boolean;
  getBaselineFor: (entryId: string | number) => Record<string, any> | undefined;
}

const initialState: EditSessionState = {
  activeMasterId: null,
  isEditing: false,
  isDirty: false,
  pendingChanges: new Map(),
  baseline: new Map(),
  saving: false,
  pendingTarget: null,
};

// Context that provides both state and API
export interface EditSessionContextValue extends EditSessionAPI {
  // Reactive state
  activeMasterId: string | null;
  isEditing: boolean;
  isDirty: boolean;
  saving: boolean;
  pendingTarget: string | null;
  pendingChanges: Map<string | number, Record<string, any>>;
  baseline: Map<string | number, Record<string, any>>;
}

const EditSessionContext = createContext<EditSessionContextValue | null>(null);

export interface EditSessionProviderProps {
  children: ReactNode;
  onSave?: (masterId: string, changes: Map<string | number, Record<string, any>>) => Promise<void>;
  onNavigate?: (target: string) => void;
}

export function EditSessionProvider({ 
  children, 
  onSave,
  onNavigate 
}: EditSessionProviderProps) {
  const [state, setState] = useState<EditSessionState>(initialState);

  const startEdit = useCallback((masterId: string, baselineData: Record<string, any>[]) => {
    if (import.meta.env.DEV) {
      console.log(`🎯 [EDIT_SESSION] Starting edit session for master ${masterId}`);
    }
    
    // Convert baseline array to Map keyed by entry ID
    const baselineMap = new Map<string | number, Record<string, any>>();
    baselineData.forEach(entry => {
      const id = entry.id || entry.entryId;
      if (id) {
        baselineMap.set(id, { ...entry }); // Deep copy each entry
      }
    });
    
    setState(prev => ({
      ...prev,
      activeMasterId: masterId,
      isEditing: true,
      isDirty: false,
      pendingChanges: new Map(),
      baseline: baselineMap,
      saving: false,
      pendingTarget: null,
    }));
  }, []);

  const stopEdit = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log('🛑 [EDIT_SESSION] Stopping edit session');
    }
    
    setState(initialState);
  }, []);

  const markDirty = useCallback((entryId: string | number, fieldName: string, value: any) => {
    setState(prev => {
      // Guardrails: only allow changes when in edit mode
      if (!prev.isEditing) {
        if (import.meta.env.DEV) {
          console.warn(`⚠️ [EDIT_SESSION] Ignoring change when not in edit mode: ${entryId}.${fieldName}`);
        }
        return prev;
      }

      const newPendingChanges = new Map(prev.pendingChanges);
      const baselineEntry = prev.baseline.get(entryId);
      
      // Get existing changes for this entry or create new
      const entryChanges = newPendingChanges.get(entryId) || {};
      
      // Check if value matches baseline (revert scenario)
      const baselineValue = baselineEntry?.[fieldName];
      const isRevertedToBaseline = value === baselineValue;
      
      if (isRevertedToBaseline) {
        // Remove the field from pending changes
        delete entryChanges[fieldName];
        
        // If no more changes for this entry, remove it entirely
        if (Object.keys(entryChanges).length === 0) {
          newPendingChanges.delete(entryId);
        } else {
          newPendingChanges.set(entryId, entryChanges);
        }
      } else {
        // Add/update the field change
        entryChanges[fieldName] = value;
        newPendingChanges.set(entryId, entryChanges);
      }
      
      // Recompute dirty state based on actual pending changes
      const isDirty = newPendingChanges.size > 0;
      
      if (import.meta.env.DEV) {
        console.log(`💫 [EDIT_SESSION] Field changed - Entry ${entryId}.${fieldName} = ${value} (baseline: ${baselineValue})`);
        console.log(`💫 [EDIT_SESSION] ${isRevertedToBaseline ? 'Reverted to baseline' : 'Changed from baseline'}`);
        console.log(`💫 [EDIT_SESSION] Dirty state: ${isDirty}, pending changes: ${newPendingChanges.size} entries`);
      }
      
      return {
        ...prev,
        isDirty,
        pendingChanges: newPendingChanges,
      };
    });
  }, []);

  const resetDirty = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log('🧹 [EDIT_SESSION] Resetting dirty state');
    }
    
    setState(prev => ({
      ...prev,
      isDirty: false,
      pendingChanges: new Map(),
    }));
  }, []);

  const setPendingTarget = useCallback((target: string | null) => {
    if (import.meta.env.DEV) {
      console.log(`🎯 [EDIT_SESSION] Setting pending target: ${target}`);
    }
    
    setState(prev => ({
      ...prev,
      pendingTarget: target,
    }));
  }, []);

  const resolvePendingNavigation = useCallback(async (action: 'save' | 'discard' | 'cancel') => {
    if (import.meta.env.DEV) {
      console.log(`🎯 [EDIT_SESSION] Resolving pending navigation with action: ${action}`);
    }

    try {
      if (action === 'save') {
        await commitSave();
      } else if (action === 'discard') {
        discardChanges();
      }

      // For save and discard, proceed with navigation
      if (action !== 'cancel' && state.pendingTarget && onNavigate) {
        onNavigate(state.pendingTarget);
      }

      // Clear pending target
      setState(prev => ({ ...prev, pendingTarget: null }));
      
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('❌ [EDIT_SESSION] Failed to resolve pending navigation:', error);
      }
      // Don't clear pendingTarget on error - user can retry
      throw error;
    }
  }, [state.pendingTarget, onNavigate]);

  const commitSave = useCallback(async () => {
    if (!state.activeMasterId || state.pendingChanges.size === 0) {
      if (import.meta.env.DEV) {
        console.log('💾 [EDIT_SESSION] No changes to save');
      }
      return;
    }

    setState(prev => ({ ...prev, saving: true }));

    try {
      if (import.meta.env.DEV) {
        console.log(`💾 [EDIT_SESSION] Committing ${state.pendingChanges.size} changes for master ${state.activeMasterId}`);
      }

      // Call the provided save handler
      if (onSave) {
        await onSave(state.activeMasterId, state.pendingChanges);
      }

      // Update baseline with saved changes and reset dirty state
      setState(prev => {
        const newBaseline = new Map(prev.baseline);
        
        // Apply pending changes to baseline
        prev.pendingChanges.forEach((entryChanges, entryId) => {
          const baselineEntry = newBaseline.get(entryId) || {};
          newBaseline.set(entryId, { ...baselineEntry, ...entryChanges });
        });

        return {
          ...prev,
          baseline: newBaseline,
          isDirty: false,
          pendingChanges: new Map(),
          saving: false,
        };
      });
      
      if (import.meta.env.DEV) {
        console.log('✅ [EDIT_SESSION] Save completed successfully');
      }

    } catch (error) {
      setState(prev => ({ ...prev, saving: false }));
      if (import.meta.env.DEV) {
        console.error('❌ [EDIT_SESSION] Save failed:', error);
      }
      throw error;
    }
  }, [state.activeMasterId, state.pendingChanges, onSave]);

  const discardChanges = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log('🗑️ [EDIT_SESSION] Discarding changes');
    }
    
    resetDirty();
  }, [resetDirty]);

  const hasUnsavedChanges = useCallback(() => {
    return state.isDirty && state.pendingChanges.size > 0;
  }, [state.isDirty, state.pendingChanges.size]);

  const isEditingMaster = useCallback((masterId: string) => {
    return state.isEditing && state.activeMasterId === masterId;
  }, [state.isEditing, state.activeMasterId]);

  const getBaselineFor = useCallback((entryId: string | number) => {
    return state.baseline.get(entryId);
  }, [state.baseline]);

  const contextValue: EditSessionContextValue = {
    // Reactive state
    activeMasterId: state.activeMasterId,
    isEditing: state.isEditing,
    isDirty: state.isDirty,
    saving: state.saving,
    pendingTarget: state.pendingTarget,
    pendingChanges: state.pendingChanges,
    baseline: state.baseline,
    
    // API methods
    startEdit,
    stopEdit,
    markDirty,
    resetDirty,
    setPendingTarget,
    resolvePendingNavigation,
    commitSave,
    discardChanges,
    hasUnsavedChanges,
    isEditingMaster,
    getBaselineFor,
  };

  return (
    <EditSessionContext.Provider value={contextValue}>
      {children}
    </EditSessionContext.Provider>
  );
}

export function useEditSession(): EditSessionContextValue {
  const context = useContext(EditSessionContext);
  if (!context) {
    throw new Error('useEditSession must be used within an EditSessionProvider');
  }
  return context;
}