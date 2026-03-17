"use client"

// npx shadcn-ui@latest add checkbox
// npm  i react-use-measure
import { Dispatch, ReactNode, SetStateAction, useState, useEffect, useId } from "react"
import { Trash } from "lucide-react"
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  Reorder,
} from "motion/react"
import useMeasure from "react-use-measure"

import { cn } from "@/lib/utils"

export type Item = {
  text: string
  checked: boolean
  id: number | string
  description: string
}

interface SortableListItemProps {
  item: Item
  order: number
  onCompleteItem: (id: number | string) => void
  onRemoveItem: (id: number | string) => void
  renderExtra?: (item: Item) => React.ReactNode
  isExpanded?: boolean
  isActive?: boolean
  className?: string
  handleDrag: () => void
  isDeleteMode?: boolean
}

function SortableListItem({
  item,
  order,
  onCompleteItem,
  onRemoveItem,
  renderExtra,
  handleDrag,
  isExpanded,
  isActive,
  className,
  isDeleteMode,
}: SortableListItemProps) {
  let [ref, bounds] = useMeasure()

  const [isElevated, setIsElevated] = useState(false)

  useEffect(() => {
    if (isActive) {
      setIsElevated(true)
    } else {
      const timer = setTimeout(() => setIsElevated(false), 500)
      return () => clearTimeout(timer)
    }
  }, [isActive])

  return (
    <motion.div className={cn("", className)} key={item.id}>
      <div className="flex w-full items-center">
        <Reorder.Item
          value={item}
          className={cn(
            "relative z-auto grow",
            "h-full rounded-3xl bg-[#1c1c1c] dark:bg-[#1c1c1c]",
            "border border-white/5",
            "cursor-grab w-full"
          )}
          key={item.id}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            height: bounds.height > 0 ? bounds.height : undefined,
            transition: {
              type: "spring",
              bounce: 0,
              duration: 0.3,
            },
          }}
          exit={{
            opacity: 0,
            transition: {
              duration: 0.05,
              type: "spring",
              bounce: 0.1,
            },
          }}
          layoutId={String(item.id)}
          layout
          dragListener={!item.checked && !isActive}
          onDragStart={handleDrag}
          style={
            (isActive || isElevated)
              ? {
                zIndex: 9999,
                position: "relative",
                overflow: "visible",
              }
              : isExpanded
                ? {
                  zIndex: 9999,
                  marginTop: 10,
                  marginBottom: 10,
                  position: "relative",
                  overflow: "visible",
                }
                : {
                  position: "relative",
                  overflow: "visible",
                }
          }
          whileDrag={{ zIndex: 9999 }}
        >
          <div ref={ref} className={cn(isExpanded ? "" : "", "z-20 w-full")}>
            <motion.div
              layout="position"
              className="flex items-center w-full"
            >
              <AnimatePresence>
                {!isExpanded ? (
                  <motion.div
                    initial={{ opacity: 0, filter: "blur(4px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(4px)" }}
                    transition={{ duration: 0.001 }}
                    className="flex items-center gap-3 min-w-0 flex-1 py-2.5"
                  >
                    {/* List Remove Actions */}
                    {isDeleteMode && (
                      <div className="pl-3 shrink-0 flex items-center justify-center">
                        <div className="h-5 w-5 shrink-0 flex items-center justify-center">
                          <div
                            className="h-full w-full flex items-center justify-center cursor-pointer text-red-500/60 hover:text-red-500 transition-colors"
                            onClick={() => onRemoveItem(item.id)}
                          >
                            <Trash className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    )}
                    {/* List Title */}
                    <motion.div
                      key={`${item.checked}`}
                      className={cn("min-w-0 flex-1 pr-1", !isDeleteMode && "pl-4")}
                      initial={{
                        opacity: 0,
                        filter: "blur(4px)",
                      }}
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      transition={{
                        bounce: 0.2,
                        delay: item.checked ? 0.2 : 0,
                        type: "spring",
                      }}
                    >
                      <h4
                        className={cn(
                          "tracking-tight text-[13px] font-medium truncate leading-normal",
                          item.checked ? "text-white/40 line-through" : "text-white/70"
                        )}
                        style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}
                      >
                        {item.text}
                      </h4>
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {/* List Item Children */}
              {renderExtra && renderExtra(item)}
            </motion.div>
          </div>
        </Reorder.Item>
        {/* We remove the red swipe-to-delete animation, as it's not needed for a standard task list */}
      </div>
    </motion.div>
  )
}

SortableListItem.displayName = "SortableListItem"

interface SortableListProps {
  items: Item[]
  setItems: Dispatch<SetStateAction<Item[]>>
  onCompleteItem: (id: number | string) => void
  onRemoveItem: (id: number | string) => void
  renderItem: (
    item: Item,
    order: number,
    onCompleteItem: (id: number | string) => void,
    onRemoveItem: (id: number | string) => void
  ) => ReactNode
}

function SortableList({
  items,
  setItems,
  onCompleteItem,
  onRemoveItem,
  renderItem,
}: SortableListProps) {
  const layoutGroupId = useId()

  if (items) {
    return (
      <div className="relative">
        <LayoutGroup id={layoutGroupId}>
          <Reorder.Group
            axis="y"
            values={items}
            onReorder={setItems}
            className="flex flex-col overflow-visible"
          >
            <AnimatePresence initial={false}>
              {items?.map((item, index) =>
                renderItem(
                  item,
                  index,
                  onCompleteItem,
                  onRemoveItem
                )
              )}
            </AnimatePresence>
          </Reorder.Group>
        </LayoutGroup>
      </div>
    )
  }
  return null
}

SortableList.displayName = "SortableList"

export { SortableList, SortableListItem }
export default SortableList
