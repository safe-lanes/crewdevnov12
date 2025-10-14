import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

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
      console.log(`📊 [BASELINE] Raw baseline data (${baselineData.length} entries):`, baselineData);
    }
    
    // Convert baseline array to Map keyed by entry ID
    const baselineMap = new Map<string | number, Record<string, any>>();
    baselineData.forEach(entry => {
      const id = entry.id || entry.entryId;
      if (id) {
        baselineMap.set(id, { ...entry }); // Deep copy each entry
        if (import.meta.env.DEV) {
          console.log(`📊 [BASELINE] Stored entry ${id}:`, { ...entry });
        }
      } else {
        if (import.meta.env.DEV) {
          console.warn(`⚠️ [BASELINE] Entry missing ID:`, entry);
        }
      }
    });
    
    if (import.meta.env.DEV) {
      console.log(`📊 [BASELINE] Final baseline map (${baselineMap.size} entries):`, Array.from(baselineMap.entries()));
    }
    
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

  // PERFORMANCE FIX: Use empty dependency array and functional setState to prevent infinite loop
  const stopEdit = useCallback(() => {
    setState(prev => {
      if (import.meta.env.DEV) {
        console.log('🛑 [EDIT_SESSION] Stopping edit session');
        console.log('🛑 [EDIT_SESSION] Previous state - isDirty:', prev.isDirty, 'pendingChanges:', prev.pendingChanges.size);
      }
      
      const newState = {
        ...initialState,
        pendingChanges: new Map(),
        baseline: new Map(),
      };
      
      if (import.meta.env.DEV) {
        console.log('🛑 [EDIT_SESSION] Edit session stopped - state reset to initial');
      }
      
      return newState;
    });
  }, []); // Empty dependency array - no state dependencies!

  const markDirty = useCallback((entryId: string | number, fieldName: string, value: any) => {
    if (import.meta.env.DEV) {
      console.log(`🎯 [DIRTY_TRACKING] markDirty called: ${entryId}.${fieldName} = ${JSON.stringify(value)}`);
    }
    
    setState(prev => {
      // Guardrails: only allow changes when in edit mode
      if (!prev.isEditing) {
        if (import.meta.env.DEV) {
          console.warn(`⚠️ [EDIT_SESSION] Ignoring change when not in edit mode: ${entryId}.${fieldName}`);
          console.warn(`⚠️ [EDIT_SESSION] Current edit state - isEditing: ${prev.isEditing}, activeMasterId: ${prev.activeMasterId}`);
        }
        return prev;
      }

      const newPendingChanges = new Map(prev.pendingChanges);
      const baselineEntry = prev.baseline.get(entryId);
      
      if (import.meta.env.DEV) {
        console.log(`🎯 [DIRTY_TRACKING] Baseline for entry ${entryId}:`, baselineEntry);
        console.log(`🎯 [DIRTY_TRACKING] All baseline entries:`, Array.from(prev.baseline.entries()));
      }
      
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
        console.log(`💫 [EDIT_SESSION] Field changed - Entry ${entryId}.${fieldName} = ${JSON.stringify(value)} (baseline: ${JSON.stringify(baselineValue)})`);
        console.log(`💫 [EDIT_SESSION] ${isRevertedToBaseline ? 'Reverted to baseline' : 'Changed from baseline'}`);
        console.log(`💫 [EDIT_SESSION] Dirty state: ${isDirty}, pending changes: ${newPendingChanges.size} entries`);
        console.log(`💫 [EDIT_SESSION] All pending changes:`, Array.from(newPendingChanges.entries()));
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

  // PERFORMANCE FIX: Use functional setState to avoid Map dependencies
  const commitSave = useCallback(async () => {
    // Use let to capture current state for async operation
    let masterId: string = '';
    let changes: Map<string | number, Record<string, any>> = new Map();
    
    setState(prev => {
      if (!prev.activeMasterId || prev.pendingChanges.size === 0) {
        if (import.meta.env.DEV) {
          console.log('💾 [EDIT_SESSION] No changes to save - activeMasterId:', prev.activeMasterId, 'pendingChanges size:', prev.pendingChanges.size);
        }
        return prev; // No changes
      }
      
      // Capture values for async operation
      masterId = prev.activeMasterId;
      changes = prev.pendingChanges;
      
      return { ...prev, saving: true };
    });

    if (!masterId || changes.size === 0) return; // Early exit if no changes

    try {
      if (import.meta.env.DEV) {
        console.log(`💾 [EDIT_SESSION] Committing ${changes.size} changes for master ${masterId}`);
        console.log(`💾 [EDIT_SESSION] Changes to commit:`, Array.from(changes.entries()));
      }

      // Call the provided save handler
      if (onSave) {
        await onSave(masterId, changes);
      } else {
        if (import.meta.env.DEV) {
          console.warn('⚠️ [EDIT_SESSION] No onSave handler provided');
        }
      }

      // Update baseline with saved changes and reset dirty state
      setState(prev => {
        const newBaseline = new Map(prev.baseline);
        
        if (import.meta.env.DEV) {
          console.log(`💾 [EDIT_SESSION] Updating baseline with ${prev.pendingChanges.size} changes`);
        }
        
        // Apply pending changes to baseline
        prev.pendingChanges.forEach((entryChanges, entryId) => {
          const baselineEntry = newBaseline.get(entryId) || {};
          const updatedEntry = { ...baselineEntry, ...entryChanges };
          newBaseline.set(entryId, updatedEntry);
          
          if (import.meta.env.DEV) {
            console.log(`💾 [EDIT_SESSION] Updated baseline for entry ${entryId}:`, updatedEntry);
          }
        });

        if (import.meta.env.DEV) {
          console.log(`💾 [EDIT_SESSION] New baseline after save:`, Array.from(newBaseline.entries()));
        }

        return {
          ...prev,
          baseline: newBaseline,
          isDirty: false,
          pendingChanges: new Map(),
          saving: false,
        };
      });
      
      if (import.meta.env.DEV) {
        console.log('✅ [EDIT_SESSION] Save completed successfully - baseline updated and dirty state reset');
      }

    } catch (error) {
      setState(prev => ({ ...prev, saving: false }));
      if (import.meta.env.DEV) {
        console.error('❌ [EDIT_SESSION] Save failed:', error);
      }
      throw error;
    }
  }, [onSave]); // Only onSave dependency - no state Maps!

  const discardChanges = useCallback(() => {
    if (import.meta.env.DEV) {
      console.log('🗑️ [EDIT_SESSION] Discarding changes');
    }
    
    resetDirty();
  }, [resetDirty]);

  // PERFORMANCE FIX: Use functional setState to avoid state dependencies
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

      // Capture pending target from state and proceed with navigation
      let targetToNavigate: string | null = null;
      setState(prev => {
        targetToNavigate = prev.pendingTarget;
        return { ...prev, pendingTarget: null };
      });

      // For save and discard, proceed with navigation
      if (action !== 'cancel' && targetToNavigate && onNavigate) {
        onNavigate(targetToNavigate);
      }
      
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('❌ [EDIT_SESSION] Failed to resolve pending navigation:', error);
      }
      // Don't clear pendingTarget on error - user can retry
      throw error;
    }
  }, [commitSave, discardChanges, onNavigate]);

  const hasUnsavedChanges = useCallback(() => {
    return state.isDirty && state.pendingChanges.size > 0;
  }, [state.isDirty, state.pendingChanges.size]);

  const isEditingMaster = useCallback((masterId: string) => {
    return state.isEditing && state.activeMasterId === masterId;
  }, [state.isEditing, state.activeMasterId]);

  // PERFORMANCE FIX: Use functional approach to avoid Map dependency
  const getBaselineFor = useCallback((entryId: string | number) => {
    let result: Record<string, any> | undefined;
    setState(prev => {
      result = prev.baseline.get(entryId);
      return prev; // No state change
    });
    return result;
  }, []); // Empty dependency array!

  // PERFORMANCE FIX: Memoize context value to prevent infinite re-renders
  // Use Map sizes instead of Maps themselves to avoid reference changes causing re-memoization
  const contextValue: EditSessionContextValue = useMemo(() => ({
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
  }), [
    state.activeMasterId,
    state.isEditing,
    state.isDirty,
    state.saving,
    state.pendingTarget,
    state.pendingChanges.size, // Use size instead of Map reference
    state.baseline.size, // Use size instead of Map reference
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
  ]);

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