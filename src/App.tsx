/* eslint-disable padding-line-between-statements */
/* eslint-disable @typescript-eslint/indent */
/* eslint-disable prettier/prettier */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/control-has-associated-label */

import React, {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import classNames from 'classnames';

import { UserWarning } from './UserWarning';
import {
  USER_ID,
  createTodo,
  deleteTodo,
  getTodos,
  updateTodo,
} from './api/todos';
import { Todo } from './types/Todo';

type FilterStatus = 'All' | 'Active' | 'Completed';

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('All');

  const [title, setTitle] = useState('');
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [processingTodoIds, setProcessingTodoIds] = useState<number[]>([]);

  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const newTodoField = useRef<HTMLInputElement>(null);
  const editField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    setError('');

    getTodos()
      .then(setTodos)
      .catch(() => {
        setError('Unable to load todos');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = setTimeout(() => {
      setError('');
    }, 3000);

    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (editingTodoId !== null) {
      editField.current?.focus();
    }
  }, [editingTodoId]);

  const activeTodos = todos.filter(todo => !todo.completed);

  const visibleTodos = useMemo(() => {
    switch (filter) {
      case 'Active':
        return todos.filter(todo => !todo.completed);

      case 'Completed':
        return todos.filter(todo => todo.completed);

      default:
        return todos;
    }
  }, [todos, filter]);

  const startProcessing = (todoId: number) => {
    setProcessingTodoIds(currentIds =>
      currentIds.includes(todoId)
        ? currentIds
        : [...currentIds, todoId],
    );
  };

  const stopProcessing = (todoId: number) => {
    setProcessingTodoIds(currentIds =>
      currentIds.filter(id => id !== todoId),
    );
  };

  const focusNewTodoField = () => {
    setTimeout(() => {
      newTodoField.current?.focus();
    }, 0);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError('Title should not be empty');
      return;
    }

    const newTodo: Todo = {
      id: 0,
      userId: USER_ID,
      title: trimmedTitle,
      completed: false,
    };

    setError('');
    setIsAdding(true);
    setTempTodo(newTodo);

    createTodo({
      userId: USER_ID,
      title: trimmedTitle,
      completed: false,
    })
      .then(createdTodo => {
        setTodos(currentTodos => [...currentTodos, createdTodo]);
        setTitle('');
      })
      .catch(() => {
        setError('Unable to add a todo');
      })
      .finally(() => {
        setIsAdding(false);
        setTempTodo(null);
        focusNewTodoField();
      });
  };

  const handleDelete = (todoId: number) => {
    setError('');
    startProcessing(todoId);

    return deleteTodo(todoId)
      .then(() => {
        setTodos(currentTodos =>
          currentTodos.filter(todo => todo.id !== todoId),
        );
      })
      .catch(() => {
        setError('Unable to delete a todo');
        throw new Error('Unable to delete a todo');
      })
      .finally(() => {
        stopProcessing(todoId);
        focusNewTodoField();
      });
  };

  const handleClearCompleted = () => {
    const completedTodos = todos.filter(todo => todo.completed);

    Promise.allSettled(
      completedTodos.map(todo => handleDelete(todo.id)),
    ).then(results => {
      const hasError = results.some(
        result => result.status === 'rejected',
      );

      if (hasError) {
        setError('Unable to delete a todo');
      }
    });
  };

  const handleToggleTodo = (todo: Todo) => {
    setError('');
    startProcessing(todo.id);

    return updateTodo(todo.id, {
      completed: !todo.completed,
    })
      .then(updatedTodo => {
        setTodos(currentTodos =>
          currentTodos.map(currentTodo =>
            currentTodo.id === todo.id
              ? updatedTodo
              : currentTodo,
          ),
        );
      })
      .catch(() => {
        setError('Unable to update a todo');
        throw new Error('Unable to update a todo');
      })
      .finally(() => {
        stopProcessing(todo.id);
        focusNewTodoField();
      });
  };

  const handleToggleAll = () => {
    const shouldComplete = !todos.every(todo => todo.completed);

    const todosToUpdate = todos.filter(
      todo => todo.completed !== shouldComplete,
    );

    setError('');

    todosToUpdate.forEach(todo => {
      startProcessing(todo.id);
    });

    Promise.allSettled(
      todosToUpdate.map(todo =>
        updateTodo(todo.id, {
          completed: shouldComplete,
        })
          .then(updatedTodo => {
            setTodos(currentTodos =>
              currentTodos.map(currentTodo =>
                currentTodo.id === updatedTodo.id
                  ? updatedTodo
                  : currentTodo,
              ),
            );
          })
          .finally(() => {
            stopProcessing(todo.id);
          }),
      ),
    ).then(results => {
      const hasError = results.some(
        result => result.status === 'rejected',
      );

      if (hasError) {
        setError('Unable to update a todo');
      }

      focusNewTodoField();
    });
  };

  const handleStartEditing = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditingTitle(todo.title);
  };

  const cancelEditing = () => {
    setEditingTodoId(null);
    setEditingTitle('');
  };

  const saveEditing = (todo: Todo) => {
    const trimmedTitle = editingTitle.trim();

    if (trimmedTitle === todo.title) {
      cancelEditing();
      focusNewTodoField();

      return;
    }

    if (!trimmedTitle) {
      handleDelete(todo.id)
      .then(() => {
        cancelEditing();
      })
      .catch(() => {
        setError('Unable to delete a todo');
      })
      .finally(() => {
        focusNewTodoField();
      });

      return;
    }

    setError('');
    startProcessing(todo.id);

    updateTodo(todo.id, {
      title: trimmedTitle,
    })
      .then(updatedTodo => {
        setTodos(currentTodos =>
          currentTodos.map(currentTodo =>
            currentTodo.id === todo.id
              ? updatedTodo
              : currentTodo,
          ),
        );

        cancelEditing();
      })
      .catch(() => {
        setError('Unable to update a todo');
      })
      .finally(() => {
        stopProcessing(todo.id);
        focusNewTodoField();
      });
  };

  const handleEditKeyUp = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Escape') {
      cancelEditing();
      focusNewTodoField();
    }
  };

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">

        {todos.length > 0 && (
          <button
            type="button"
            data-cy="ToggleAllButton"
            className={classNames('todoapp__toggle-all', {
              active:
                todos.every(todo => todo.completed),
            })}
            onClick={handleToggleAll}
          />
        )}

          <form onSubmit={handleSubmit}>
            <input
              ref={newTodoField}
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={title}
              onChange={event => setTitle(event.target.value)}
              disabled={isAdding}
              autoFocus
            />
          </form>
        </header>

        <section
          className="todoapp__main"
          data-cy="TodoList"
          style={{
            display: todos.length || tempTodo ? 'block' : 'none',
          }}
        >
          {visibleTodos.map(todo => (
            <div
              key={todo.id}
              data-cy="Todo"
              className={classNames('todo', {
                completed: todo.completed,
              })}
            >
              <label className="todo__status-label">
                <input
                  data-cy="TodoStatus"
                  type="checkbox"
                  className="todo__status"
                  checked={todo.completed}
                  onChange={() => handleToggleTodo(todo)}
                />
              </label>

              {editingTodoId === todo.id ? (
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    saveEditing(todo);
                  }}
                >
                  <input
                    ref={editField}
                    data-cy="TodoTitleField"
                    type="text"
                    className="todo__title-field"
                    value={editingTitle}
                    onChange={event =>
                      setEditingTitle(event.target.value)
                    }
                    onBlur={() => saveEditing(todo)}
                    onKeyUp= {handleEditKeyUp}

                  />
                </form>
              ) : (
                <>
                  <span
                    data-cy="TodoTitle"
                    className="todo__title"
                    onDoubleClick={() =>
                      handleStartEditing(todo)
                    }
                  >
                    {todo.title}
                  </span>

                  <button
                    type="button"
                    className="todo__remove"
                    data-cy="TodoDelete"
                    onClick={() => handleDelete(todo.id)}
                  >
                    ×
                  </button>
                </>
              )}

              <div
                data-cy="TodoLoader"
                className={classNames('modal overlay', {
                  'is-active':
                    loading ||
                    processingTodoIds.includes(todo.id),
                })}
              >
                <div className="modal-background has-background-white-ter" />
                <div className="loader" />
              </div>
            </div>
          ))}

          {tempTodo && (
            <div data-cy="Todo" className="todo">
              <label className="todo__status-label">
                <input
                  data-cy="TodoStatus"
                  type="checkbox"
                  className="todo__status"
                  checked={false}
                  readOnly
                />
              </label>

              <span
                data-cy="TodoTitle"
                className="todo__title"
              >
                {tempTodo.title}
              </span>

              <button
                type="button"
                className="todo__remove"
                data-cy="TodoDelete"
              >
                ×
              </button>

              <div
                data-cy="TodoLoader"
                className="modal overlay is-active"
              >
                <div className="modal-background has-background-white-ter" />
                <div className="loader" />
              </div>
            </div>
          )}
        </section>

        {todos.length > 0 && (
          <footer
            className="todoapp__footer"
            data-cy="Footer"
          >
            <span
              className="todo-count"
              data-cy="TodosCounter"
            >
              {activeTodos.length} items left
            </span>

            <nav
              className="filter"
              data-cy="Filter"
            >
              <a
                href="#/"
                className={classNames('filter__link', {
                  selected: filter === 'All',
                })}
                data-cy="FilterLinkAll"
                onClick={() => setFilter('All')}
              >
                All
              </a>

              <a
                href="#/active"
                className={classNames('filter__link', {
                  selected: filter === 'Active',
                })}
                data-cy="FilterLinkActive"
                onClick={() => setFilter('Active')}
              >
                Active
              </a>

              <a
                href="#/completed"
                className={classNames('filter__link', {
                  selected: filter === 'Completed',
                })}
                data-cy="FilterLinkCompleted"
                onClick={() => setFilter('Completed')}
              >
                Completed
              </a>
            </nav>

            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              disabled={!todos.some(todo => todo.completed)}
              onClick={handleClearCompleted}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <div
        data-cy="ErrorNotification"
        className={classNames(
          'notification is-danger is-light has-text-weight-normal',
          {
            hidden: !error,
          },
        )}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={() => setError('')}
        />

        {error}
      </div>
    </div>
  );
};
