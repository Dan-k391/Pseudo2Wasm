;; while loop

(loop $label
 (if (condition)
  (then
   (body)
   (br $label)
  )
 )
)

;; repeat loop

(loop $label
 (body)
 (if (i32.eqz (condition))
  (then
   (br $label)
  )
 )
)

;; for loop

(init)
(loop $label
 (if (condition)
  (then
   (body)
   (step)
   (br $label)
  )
 )
)