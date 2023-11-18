(module
 (type $externref_=>_i32 (func (param externref) (result i32)))
 (type $i32_=>_none (func (param i32)))
 (type $none_=>_i32 (func (result i32)))
 (type $i32_=>_i32 (func (param i32) (result i32)))
 (type $f64_=>_none (func (param f64)))
 (type $none_=>_none (func))
 (type $none_=>_f64 (func (result f64)))
 (type $externref_=>_f64 (func (param externref) (result f64)))
 (import "env" "buffer" (memory $0 0 65536))
 (import "env" "logInteger" (func $logInteger (param i32)))
 (import "env" "logReal" (func $logReal (param f64)))
 (import "env" "logChar" (func $logChar (param i32)))
 (import "env" "logString" (func $logString (param i32)))
 (import "env" "logBoolean" (func $logBoolean (param i32)))
 (import "env" "randomInteger" (func $RAND (param i32) (result i32)))
 (import "env" "inputInteger" (func $import$inputInteger (param externref) (result i32)))
 (import "env" "inputReal" (func $import$inputReal (param externref) (result f64)))
 (import "env" "inputChar" (func $import$inputChar (param externref) (result i32)))
 (import "env" "inputString" (func $import$inputString (param externref) (result i32)))
 (import "env" "inputBoolean" (func $import$inputBoolean (param externref) (result i32)))
 (global $__stackTop (mut i32) (i32.const 65536))
 (global $__stackBase (mut i32) (i32.const 65536))
 (global $suspender (mut externref) (ref.null noextern))
 (export "main" (func $export$__main))
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
 (func $__main
  (block
  )
  (block
  )
  (block
  )
  (i32.store align=1
   (i32.add
    (i32.const 0)
    (i32.mul
     (i32.add
      (i32.const 0)
      (i32.mul
       (i32.sub
        (i32.const 0)
        (i32.const 0)
       )
       (i32.const 1)
      )
     )
     (i32.const 4)
    )
   )
   (i32.const 22)
  )
  (i32.store align=1
   (i32.const 44)
   (i32.const 0)
  )
  (call $logInteger
   (i32.load align=1
    (i32.add
     (i32.const 44)
     (i32.mul
      (i32.const 0)
      (i32.const 4)
     )
    )
   )
  )
 )
 (func $export$__main (param $susp externref) (result i32)
  (global.set $suspender
   (local.get $susp)
  )
  (call $__main)
  (i32.const 0)
 )
 (func $inputInteger (result i32)
  (local $0 externref)
  (local $1 i32)
  (local.set $0
   (global.get $suspender)
  )
  (local.set $1
   (call $import$inputInteger
    (global.get $suspender)
   )
  )
  (global.set $suspender
   (local.get $0)
  )
  (local.get $1)
 )
 (func $inputReal (result f64)
  (local $0 externref)
  (local $1 f64)
  (local.set $0
   (global.get $suspender)
  )
  (local.set $1
   (call $import$inputReal
    (global.get $suspender)
   )
  )
  (global.set $suspender
   (local.get $0)
  )
  (local.get $1)
 )
 (func $inputChar (result i32)
  (local $0 externref)
  (local $1 i32)
  (local.set $0
   (global.get $suspender)
  )
  (local.set $1
   (call $import$inputChar
    (global.get $suspender)
   )
  )
  (global.set $suspender
   (local.get $0)
  )
  (local.get $1)
 )
 (func $inputString (result i32)
  (local $0 externref)
  (local $1 i32)
  (local.set $0
   (global.get $suspender)
  )
  (local.set $1
   (call $import$inputString
    (global.get $suspender)
   )
  )
  (global.set $suspender
   (local.get $0)
  )
  (local.get $1)
 )
 (func $inputBoolean (result i32)
  (local $0 externref)
  (local $1 i32)
  (local.set $0
   (global.get $suspender)
  )
  (local.set $1
   (call $import$inputBoolean
    (global.get $suspender)
   )
  )
  (global.set $suspender
   (local.get $0)
  )
  (local.get $1)
 )
)