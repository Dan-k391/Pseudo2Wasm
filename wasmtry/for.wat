(module
 (type $i32_=>_none (func (param i32)))
 (type $i32_=>_i32 (func (param i32) (result i32)))
 (type $f64_=>_none (func (param f64)))
 (type $none_=>_none (func))
 (import "env" "buffer" (memory $0 0 65536))
 (import "env" "logInteger" (func $logInteger (param i32)))
 (import "env" "logReal" (func $logReal (param f64)))
 (import "env" "logChar" (func $logChar (param i32)))
 (import "env" "logString" (func $logString (param i32)))
 (global $__stackTop (mut i32) (i32.const 0))
 (global $__stackBase (mut i32) (i32.const 0))
 (export "main" (func $__main))
 (start $__main)
 (func $LENGTH (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local.set $1
   (local.get $0)
  )
  (local.set $2
   (i32.const 0)
  )
  (loop $0
   (if
    (i32.load8_u
     (local.get $1)
    )
    (block
     (if
      (i32.ne
       (i32.and
        (i32.load8_u
         (local.get $1)
        )
        (i32.const 192)
       )
       (i32.const 128)
      )
      (local.set $2
       (i32.add
        (local.get $2)
        (i32.const 1)
       )
      )
     )
     (local.set $1
      (i32.add
       (local.get $1)
       (i32.const 1)
      )
     )
     (br $0)
    )
   )
  )
  (return
   (local.get $2)
  )
 )
 (func $for (param $0 i32) (result i32)
  (local $1 i32)
  (block $__callablePrologue
   (i32.store align=1
    (global.get $__stackTop)
    (global.get $__stackBase)
   )
   (global.set $__stackTop
    (i32.add
     (global.get $__stackTop)
     (i32.const 4)
    )
   )
   (global.set $__stackBase
    (global.get $__stackTop)
   )
  )
  (block $__paramInit
   (i32.store align=1
    (i32.add
     (global.get $__stackBase)
     (i32.const 0)
    )
    (local.get $0)
   )
   (global.set $__stackTop
    (i32.add
     (global.get $__stackTop)
     (i32.const 4)
    )
   )
  )
  (global.set $__stackTop
   (i32.add
    (global.get $__stackTop)
    (i32.const 4)
   )
  )
  (global.set $__stackTop
   (i32.add
    (global.get $__stackTop)
    (i32.const 4)
   )
  )
  (block
   (i32.store align=1
    (i32.const 4)
    (i32.const 1)
   )
   (loop $1
    (if
     (i32.ge_s
      (i32.load align=1
       (i32.add
        (global.get $__stackBase)
        (i32.const 0)
       )
      )
      (i32.load align=1
       (i32.const 4)
      )
     )
     (block
      (i32.store align=1
       (i32.add
        (global.get $__stackBase)
        (i32.const 8)
       )
       (i32.load align=1
        (i32.add
         (global.get $__stackBase)
         (i32.const 4)
        )
       )
      )
      (i32.store align=1
       (i32.const 4)
       (i32.add
        (i32.load align=1
         (i32.const 4)
        )
        (i32.const 1)
       )
      )
      (br $1)
     )
    )
   )
  )
  (block
   (local.set $1
    (i32.load align=1
     (i32.add
      (global.get $__stackBase)
      (i32.const 8)
     )
    )
   )
   (global.set $__stackTop
    (global.get $__stackBase)
   )
   (global.set $__stackTop
    (i32.sub
     (global.get $__stackTop)
     (i32.const 4)
    )
   )
   (global.set $__stackBase
    (i32.load align=1
     (global.get $__stackTop)
    )
   )
   (return
    (local.get $1)
   )
  )
  (block $__callableEpilogue
   (global.set $__stackTop
    (global.get $__stackBase)
   )
   (global.set $__stackTop
    (i32.sub
     (global.get $__stackTop)
     (i32.const 4)
    )
   )
   (global.set $__stackBase
    (i32.load align=1
     (global.get $__stackTop)
    )
   )
  )
 )
 (func $__main
  (call $logInteger
   (call $for
    (i32.const 10)
   )
  )
 )
)